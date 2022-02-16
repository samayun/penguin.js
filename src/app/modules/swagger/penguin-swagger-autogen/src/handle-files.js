const fs = require('fs');
const JSON5 = require('json5');
const merge = require('deepmerge');
const swaggerTags = require('./swagger-tags');
const handleData = require('./handle-data');
const statics = require('./statics');
const utils = require('./utils');
const codeParser = require('./code-parser');

const overwriteMerge = (destinationArray, sourceArray, options) => {
  if (destinationArray || sourceArray || options) return sourceArray;
};

/**
 * Recognize and handle a file and its endpoints.
 * @param {string} filePath file's path.
 * @param {string} pathRoute Route's path to which file endpoints belong.
 * @param {string} relativePath Relative file's path.
 * @param {array} receivedRouteMiddlewares Array containing middleware to be applied in the endpoint's file.
 */
function readEndpointFile(
  filePath,
  pathRoute = '',
  relativePath,
  receivedRouteMiddlewares = [],
  restrictedContent,
) {
  return new Promise(resolve => {
    let paths = {};
    fs.readFile(filePath, 'utf8', async function (err, data) {
      if (err || data.trim() === '') {
        return resolve(false);
      }

      /**
       * Experimental parser. Used to get variables
       * In the future, will be used to get other patterns
       */
      let jsParsed = codeParser.jsParser(await handleData.removeComments(data, true));

      // If 'jsParsed' == null, try to get only the variables
      if (!jsParsed) {
        jsParsed = await codeParser.jsParserEsModule(data);
      }

      const keywords = ['route', 'use', ...statics.METHODS];
      let regex = '';
      keywords.forEach(word => (regex += `\\s*\\n*\\t*\\.\\s*\\n*\\t*${word}\\s*\\n*\\t*\\(|`));
      regex = regex.replace(/\|$/, '');

      /**
       * dataToGetPatterns: this variable will be used to get
       * patterns before of method, such as: app, route, etc.
       */
      let dataToGetPatterns = data; // dataToGetPatterns = 'data' without strings, comments and inside parentheses
      dataToGetPatterns = await handleData.removeComments(dataToGetPatterns, false);
      dataToGetPatterns = await handleData.removeStrings(dataToGetPatterns);
      dataToGetPatterns = await handleData.removeInsideParentheses(dataToGetPatterns, true);

      /**
       * Bugfix when HTTP methods are at the end of 'dataToGetPatterns'
       * Issue: #49
       */
      if (dataToGetPatterns) {
        const lastElem = dataToGetPatterns.split('.').slice(-1)[0].replaceAll(' ', '');
        if (statics.METHODS.includes(lastElem)) {
          dataToGetPatterns += '(';
        }
      }
      /* END CASE */

      let firstPattern = null;
      let patternsServer = []; // Stores patterns, such as: route, app, etc...
      const propRoutes = []; // Used to store the new Router() properties, such as 'prefix'
      let regexRouteMiddlewares = '';
      let dataSrc = null;

      /**
       * CASE:
       * import UserRouters from "./user";
       * ...
       * router.use("/", new UserRouters().routes);
       */

      restrictedContent ? (dataSrc = restrictedContent) : (dataSrc = data);

      let aData = await handleData.removeComments(dataSrc, true);
      aData = await handleData.clearData(aData);
      const converted = await handleData.dataConverter(aData);
      aData = converted.data;
      patternsServer = converted.patterns;

      /**
       * Eliminating unwanted patterns within endpoints
       * Avoinding cases, such as: route.get('/path', ... ...query().delete().where(...); whithin of the endpoint's functions make problems because of the '.delete()'
       */
      let aDataAux = aData;
      let finished = false;
      let aDataToClean = new Set();
      let count = 0;
      while (!finished && count < 300) {
        count += 1; // To avoid infinite loop
        let dat = await utils.stack0SymbolRecognizer(aDataAux, '(', ')');
        if (dat == null) {
          finished = true;
          continue;
        }

        aDataToClean.add(dat);
        dat = `(${dat})`;
        aDataAux = aDataAux.replace(dat, ' ');
      }

      aDataToClean = [...aDataToClean]; // converting to array
      for (let idxData = 0; idxData < aDataToClean.length; ++idxData) {
        let data = aDataToClean[idxData];
        const swaggerComments = await handleData.getSwaggerComments(data);
        data = await handleData.removeComments(data);

        // Avoiding ploblems when functions has the same name of a .methods
        for (let idxMet = 0; idxMet < statics.METHODS.length; ++idxMet) {
          const method = statics.METHODS[idxMet];
          data = data.split(new RegExp(`\\.\\s*\\n*\\t*${method}`));
          data = data.join(`.{_{__function__}_}${method}`);
        }
        data = `(${data}${swaggerComments !== '' ? `\n${swaggerComments}` : ''})`;
        aData = aData.replaceAll(`(${aDataToClean[idxData]})`, data);
      }

      /**
       * CASE: const router = new Router({ prefix: '/api/v1' });
       */
      const regexNewRouter = /(\w*\s*\n*\t*=\s*\n*\t*new\s*\n*\t*Router\s*\n*\t*\(\s*\n*\t*{)/;
      if (regexNewRouter.test(aData)) {
        const routes = aData.split(regexNewRouter);
        for (let index = 1; index < routes.length; index += 2) {
          const route = routes[index];
          const prop = routes[index + 1];
          const routerObj = {
            routeName: null,
          };

          if (route.includes('Router') && prop.includes('prefix')) {
            routerObj.routeName = route.split(new RegExp('\\=|\\s|\\n|\\t'))[0].replaceAll(' ', '');
            let prefix = prop;
            prefix = prefix.split(/\}\s*\n*\t*\)/)[0];
            if (prefix && prefix.split(new RegExp('\\s*prefix\\s*\\n*\\t*\\:').length > 1)) {
              prefix = prefix
                .split(new RegExp('\\s*prefix\\s*\\n*\\t*\\:\\s*\\n*\\t*'))[1]
                .trimLeft();
              prefix = prefix.split(new RegExp('\\s|\\n|\\t|\\,'))[0].trim();
              prefix = prefix.replaceAll("'", '').replaceAll('"', '').replaceAll('`', '');
            }
            routerObj.prefix = prefix;
            propRoutes.push(routerObj);
          }
        }
      }
      /* END CASE */

      if (aData.includes(`${statics.SWAGGER_TAG}.patterns`)) {
        /**
         * Manual pattern recognition
         * NOTE: Deprecated
         */

        let patterns = new Set(patternsServer);

        try {
          patterns = eval(
            aData.replaceAll(' ', '').split(`${statics.SWAGGER_TAG}.patterns=`)[1].split('*/')[0],
          );
        } catch (err) {
          console.error(
            `Syntax error: ${statics.SWAGGER_TAG}.patterns${
              aData.split(`${statics.SWAGGER_TAG}.patterns`)[1].split('*/')[0]
            }`,
          );
          console.error(err);
          return resolve(false);
        }

        if (patterns.size > 0) {
          patterns.add('____CHAINED____'); // CASE: router.get(...).post(...).put(...)...
        }

        regex = '';
        patterns.forEach(pattern => {
          if (
            pattern &&
            pattern.split(
              new RegExp(
                '\\!|\\=|\\<|\\>|\\,|\\;|\\:|\\{|\\}|\\(|\\)|\\[|\\]|axios|superagent|request|fetch|supertest',
                'i',
              ),
            ).length > 1
          ) {
            return;
          }

          if (!firstPattern) {
            firstPattern = pattern;
          }

          const keywords = [...statics.METHODS];
          keywords.forEach(
            word =>
              (regex += `(\\s|\\n|\\t|;|\\*\\/)${pattern}\\s*\\n*\\t*\\.\\s*\\n*\\t*${word}\\s*\\n*\\t*\\(|`),
          );

          regexRouteMiddlewares += `\\/?\\s*\\n*\\t*${pattern}\\s*\\n*\\t*\\.\\s*\\n*\\t*use\\s*\\n*\\t*\\(|`;
        });
        regex = regex.replace(/\|$/, '');
        regexRouteMiddlewares = regexRouteMiddlewares.slice(0, -1);
        patternsServer = [...patterns];
      } else {
        /**
         * Automatic pattern recognition
         */

        let serverVars = [];
        const patterns = new Set(patternsServer);

        serverVars = dataToGetPatterns.split(new RegExp(regex));
        if (serverVars && serverVars.length > 1)
          serverVars.forEach(pattern => {
            const auxPattern = pattern
              .split(new RegExp(regex))[0]
              .split(/\n|\s|\t|';'|\{|\}|\(|\)|\[|\]/)
              .splice(-1)[0]; // e.g.: app, route, server, etc.
            if (auxPattern && auxPattern != '') patterns.add(auxPattern);
          });

        if (patterns.size > 0) patterns.add('____CHAINED____'); // CASE: router.get(...).post(...).put(...)...

        regex = '';
        patterns.forEach(pattern => {
          if (
            pattern.split(
              new RegExp(
                '\\!|\\=|\\<|\\>|\\,|\\;|\\:|\\{|\\}|\\(|\\)|\\[|\\]|axios|superagent|request|fetch|supertest',
                'i',
              ),
            ).length > 1
          ) {
            return;
          }
          if (!firstPattern) {
            firstPattern = pattern;
          }

          const keywords = [...statics.METHODS, 'route'];
          keywords.forEach(
            word =>
              (regex += `(\\s|\\n|\\t|;|\\*\\/)${pattern}\\s*\\n*\\t*\\.\\s*\\n*\\t*${word}\\s*\\n*\\t*\\(|`),
          );

          regexRouteMiddlewares += `(\\/?\\s*\\n*\\t*${pattern}\\s*\\n*\\t*\\.\\s*\\n*\\t*use\\s*\\n*\\t*\\(\\s*\\n*\\t*)|`;
        });
        regex = regex.replace(/\|$/, '');

        regexRouteMiddlewares = regexRouteMiddlewares.slice(0, -1);
        patternsServer = [...patterns];
      }

      let aForcedsEndpoints = swaggerTags.getForcedEndpoints(aData, { filePath });
      aForcedsEndpoints = aForcedsEndpoints.map(forced => {
        return (forced += `\n${statics.STRING_BREAKER}FORCED${statics.STRING_BREAKER}\n`);
      });

      /**
       * routeMiddlewares: This will cause the middleware to be passed on to all sub-routes
       */
      const routeMiddlewares = [
        ...receivedRouteMiddlewares.map(r => {
          r.path = false;
          r.fixedRoute = true;
          r.bytePosition = -1;
          return r;
        }),
      ];

      /**
       * CASE: router.use(middleware).get(...).post(...).put(...)...
       * REFACTOR: pass to function
       */
      const rawRouteMiddlewares = aData.split(new RegExp(regexRouteMiddlewares));
      rawRouteMiddlewares.shift();
      const localRouteMiddlewares = []; // localRouteMiddlewares: Used to store and to apply middleware's route in the local endpoints

      aData = await handleData.addReferenceToMethods(aData, patternsServer);

      /**
       * CASE:
       * router.all('/...', ...)
       */
      aData = aData.split(new RegExp('\\.\\s*all\\s*\\(\\[\\_\\[all\\]\\_\\]\\)\\(\\[\\_\\['));
      aData = aData.join('.use([_[use]_])([_[');
      /* END CASE */

      const aDataRaw = aData;

      /**
       * Getting the reference of all files brought with 'import' and 'require'
       */
      let importedFiles = null;
      let aRoutes = null;
      let routePrefix = ''; // prefix of new Router()

      if (restrictedContent) {
        restrictedContent = await handleData.removeComments(restrictedContent);
        importedFiles = await getImportedFiles(data, relativePath);
      } else {
        importedFiles = await getImportedFiles(aDataRaw, relativePath);
      }

      if (regex != '') {
        // Some method was found like: .get, .post, etc.
        aData = [...aData.split(new RegExp(regex)), ...aForcedsEndpoints];
        aData[0] = undefined; // Delete 'header'
        aData = aData.filter(data => {
          if (data && data.replaceAll('\n', '').replaceAll(' ', '').replaceAll('\t', '') != '') {
            return true;
          }
          return false;
        });

        let aDataRawCleaned = await handleData.removeComments(aDataRaw, true);

        aDataRawCleaned = aDataRawCleaned.replaceAll('\n', ' ');
        aRoutes = aDataRawCleaned.split(new RegExp(`\\s*\\t*\\w\\s*\\t*\\.\\s*\\t*use\\s*\\t*\\(`));
        if (aRoutes.length > 1) {
          aRoutes.shift();
        }

        aData = [...aRoutes, ...aData];

        let lastValidPattern = '';
        /**
         * All endpoints will be processed here
         */
        for (let idxElem = 0; idxElem < aData.length; idxElem++) {
          let elem = aData[idxElem];
          if (!elem || elem.slice(0, 3) !== '[_[') {
            continue;
          }

          let endpointFunctions = [];
          let rawPath = codeParser.getUntil(elem, ',');
          let bytePosition = null;
          if (rawPath.split(']_])(')[2]) {
            bytePosition = parseInt(rawPath.split(']_])(')[2].split('[_[')[1]);
            rawPath = rawPath.split('_])(')[3];
            if (
              (rawPath && rawPath.includes(')') && !rawPath.split(')')[0].includes('(')) ||
              rawPath == data
            ) {
              // has no path
              rawPath = false;
            }
          }

          // Middleware without path. TODO: handle arrow function
          if (rawPath && rawPath.split(new RegExp('\\s*function\\s*\\(')).length > 1) {
            rawPath = '';
          }

          let rawPathResolved = rawPath ? rawPath.replaceAll(' ', '') : false;
          rawPathResolved = await codeParser.resolvePathVariables(
            rawPathResolved,
            bytePosition,
            jsParsed,
            importedFiles,
          );

          let endpointSwaggers = null;
          let objEndpoint = {};
          let path = false;
          let method = false;
          let predefMethod = false;
          let req = null;
          let res = null;
          let autoMode = true;
          let objParameters = {};
          let objResponses = {};
          let forced = false;
          let predefPattern = false;
          let isChained = false;

          if (elem && elem.includes('[_[') && elem.includes(']_]')) {
            elem = elem.split(new RegExp('\\[_\\[|\\]_\\]\\)\\('));
            predefMethod = elem[1];
            predefPattern = elem[3];
            bytePosition = parseInt(elem[5]);

            if (predefPattern === '____CHAINED____') {
              // CASE: router.get(...).post(...).put(...)...
              predefPattern = lastValidPattern;
              isChained = true;
            } else {
              lastValidPattern = predefPattern;
            }

            // CASE: router.use(middleware).get(...).post(...).put(...)...
            if (elem[6] && elem[6].includes('____CHAINED____')) {
              const midd = elem[6].split('____CHAINED____')[0];
              localRouteMiddlewares.push({
                middleware: midd,
                rawRoute: aData[idxElem].split(midd)[1],
              });
              continue;
            }

            const prefixFound = propRoutes.find(r => r.routeName === predefPattern);
            if (prefixFound) {
              routePrefix = prefixFound.prefix || '';
            } else {
              routePrefix = '';
            }

            if (elem.length < 5) {
              // Forced Endpoint
              const found = elem.find(e => e.includes('/_undefined_path_0x'));
              if (found) {
                elem = found;
                endpointFunctions.push({
                  metadata: null,
                  callbackParameters: null,
                  func: found,
                });
              } else {
                continue;
              }
            } else {
              elem = elem[6];
            }

            elem = elem.trim();
            if (elem.includes('#swagger.path')) {
              rawPath = swaggerTags.getPath(elem, autoMode);
            }
          }

          elem = await utils.stackSymbolRecognizer(elem, '(', ')');

          /**
           * CASE (continuing): router.use(middleware).get(...).post(...).put(...)...
           * Adding middleware to be processed together with the other endpoint functions
           */
          if (isChained) {
            const endpointRegex = `\\(\\[\\_\\[${predefMethod}\\]\\_\\]\\)\\(\\[\\_\\[____CHAINED____\\]\\_\\]\\)\\(\\[\\_\\[${bytePosition}\\]\\_\\]\\)\\(\\s*\\n*\\t*${rawPath}\\s*\\n*\\t*\\,`;
            const found = localRouteMiddlewares.find(
              midd => midd.rawRoute && midd.rawRoute.split(new RegExp(endpointRegex)).length > 1,
            );
            if (found) {
              elem += `,${found.middleware}`;
            }
          }

          if (elem.includes(`${statics.STRING_BREAKER}FORCED${statics.STRING_BREAKER}`)) {
            forced = true;
          }

          if (swaggerTags.getIgnoreTag(elem)) {
            continue;
          }

          autoMode = swaggerTags.getAutoTag(elem);
          const elemOrig = elem;

          /**
           * Handling passed functions in the endpoint parameter, such as: app.get("/path", ...)
           */
          let elemParam = await handleData.removeStrings(elem);
          elemParam = await handleData.removeComments(elemParam);
          if ((elemParam && elemParam.split(',').length > 1 && !forced) || predefMethod === 'use') {
            let functions = []; // Array that contains possible functions in other files
            let auxElem = await handleData.removeComments(elem);
            auxElem = auxElem.replace(rawPath, '');
            let functionsInParameters = auxElem;
            if (functionsInParameters.slice(-1)[0] == ')') {
              // REFACTOR: use regex
              functionsInParameters = functionsInParameters.slice(0, -1);
            }
            functionsInParameters = functionsInParameters.split(',');

            auxElem = auxElem.replaceAll('\n', '').replaceAll(' ', '');
            if (auxElem.split(',').length > 1 || predefMethod === 'use') {
              /**
               * Handling foo.method('/path', ..., ...)'
               * Getting function not referenced ( such as: (req, res) => { ... } )
               */

              let functionsStr = elemOrig.replace(rawPath, '').split(',');

              if (functionsStr.length > 1 && rawPath) {
                functionsStr.shift();
              }
              functionsStr = functionsStr.join(',');

              functionsStr = functionsStr.split(new RegExp('^\\s*function\\s*\\('));
              functionsStr = functionsStr.join('(');
              functionsStr = functionsStr.split(new RegExp('\\,\\s*function\\s*\\('));
              functionsStr = functionsStr.join('( (');

              functionsStr = functionsStr.replaceAll('{_{__function__}_}', '');
              for (let idxFunc = 0; idxFunc < 15; ++idxFunc) {
                // Adding '(' and ')' to arrow functions that not contains '(' and ')', such as: async req => {
                if (
                  functionsStr &&
                  functionsStr.split(new RegExp('\\s*\\t*=>\\s*\\n*\\t*').length > 1)
                ) {
                  const params = functionsStr.trim().split(new RegExp('\\s*\\t*=>\\s*\\n*\\t*'));
                  if (params && params.length > 1 && params[0].trim().slice(-1)[0] !== ')') {
                    let paramsAux = params[0].split(new RegExp('\\s+|\\n+|\\t+|\\,|\\.|\\;|\\:'));
                    paramsAux = paramsAux.slice(-1)[0];
                    if (
                      paramsAux.split(/\*|\\|\/|\(|\)|\{|\}|\[|\]/).length === 1 &&
                      paramsAux !== ''
                    )
                      functionsStr = functionsStr.replace(
                        new RegExp(`${paramsAux}\\s*\\t*=>\\s*\\n*\\t*`),
                        `(${paramsAux}) => `,
                      );
                  }
                }

                const funcNotReferenced = await handleData.popFunction(functionsStr);
                if (predefMethod == 'use' && funcNotReferenced) {
                  if (funcNotReferenced.split(')')[0].split(',').length > 2) {
                    let isLocalRouteMiddleware = false;
                    if (aData[idxElem].split(new RegExp(regex)).length > 1) {
                      // Verify if is not a local route middleware, such as: route.use(middleware).get(...).post(...)...
                      isLocalRouteMiddleware = true;
                    }
                    routeMiddlewares.push({
                      metadata: null,
                      callbackParameters: null,
                      func: funcNotReferenced,
                      middleware: true,
                      path: rawPathResolved === '' ? false : rawPathResolved,
                      isLocalRouteMiddleware,
                      bytePosition,
                    });
                    functionsStr = functionsStr.replace(funcNotReferenced, ' ');
                  }
                } else if (funcNotReferenced) {
                  /**
                   * CASE:
                   * app.method("/foo", (req, res) => {
                   *    foo(req, res);
                   * });
                   */
                  if (funcNotReferenced.trim()[0] == '(') {
                    // there are parameters
                    const funcNotRefFormated = funcNotReferenced
                      .replaceAll('(', '( ')
                      .replaceAll(')', ' )');
                    let funcParams = await utils.stack0SymbolRecognizer(
                      funcNotRefFormated,
                      '(',
                      ')',
                    );
                    let regexParams = '';

                    if (funcParams) {
                      funcParams = funcParams.split(
                        new RegExp(
                          '\\:\\s*\\n*\\t*Request\\s*\\n*\\t*|\\:\\s*\\n*\\t*Response\\s*\\n*\\t*|\\:\\s*\\n*\\t*Next\\s*\\n*\\t*|\\:\\s*\\n*\\t*any\\s*\\n*\\t*',
                          'i',
                        ),
                      );
                      let tsFunction = false;
                      if (funcParams.length > 1) {
                        tsFunction = true;
                      }

                      funcParams = funcParams
                        .join('')
                        .replaceAll('\n', '')
                        .replaceAll(' ', '')
                        .split(',');
                      const numParams = funcParams.length;

                      for (let idx = 0; idx < numParams; ++idx) {
                        regexParams += `\\([\\w|\\s]*\\,?[\\w|\\s]*\\,?[\\w|\\s]*[\\s|\\,]+${funcParams[idx]}[\\s|\\,]+[\\w|\\s]*\\,?[\\w|\\s]*\\,?[\\w|\\s]*\\)|`;
                      }
                      regexParams = regexParams.slice(0, -1);

                      let refFunc = null;
                      if (funcNotRefFormated) {
                        refFunc = funcNotRefFormated.split(new RegExp(regexParams));
                      }

                      if (refFunc && refFunc.length > 1) {
                        if (tsFunction) {
                          refFunc = refFunc.slice(0, -1);
                        } else {
                          refFunc = refFunc.slice(1, -1);
                        }
                        refFunc.forEach(f => {
                          let func = f
                            .replaceAll('\n', ' ')
                            .split(new RegExp('\\s*\\t*\\.\\s*\\t*'));
                          func = func.join('.');
                          func = func.trim().split(new RegExp('\\s|\\n|\\t|\\;|\\/|\\,'));
                          func = func.slice(-1)[0].trim();
                          if (!statics.RESERVED_FUNCTIONS.includes(func)) {
                            // TODO: improve this?
                            functions.push(func);
                          }
                        });
                      }
                    }
                  }
                  /* END CASE */

                  if (functionsStr && functionsStr.split(funcNotReferenced).length > 1) {
                    functionsStr = functionsStr.replace(funcNotReferenced, ' ');
                  } else {
                    const params = await utils.stack0SymbolRecognizer(funcNotReferenced, '(', ')');
                    if (params && functionsStr.split(`(${params})`).length > 1) {
                      functionsStr = functionsStr.replace(`(${params})`, ' ');
                    } else {
                      // TODO: verify this case
                    }
                  }

                  if (funcNotReferenced.includes('(') && funcNotReferenced.includes(')')) {
                    endpointFunctions.push({
                      metadata: null,
                      callbackParameters: null,
                      func: funcNotReferenced,
                    });
                  }
                } else {
                  break;
                }
              }

              // endpointSwaggers: Keep 'global' #swaggers in the endpoints, such as: foo.get('/path', /* #swagger.description = "..." */ functions...)
              endpointSwaggers = await handleData.getSwaggerComments(functionsStr);
              functionsStr = await handleData.removeComments(functionsStr);
              functions = [...functions, ...functionsStr.split(',')];
            }

            /**
             * functions: Array that contains possible functions in other files
             */
            for (let index = 0; index < functions.length; index++) {
              let func = functions[index];
              if (!func) {
                continue;
              }

              const funcTest = func.replaceAll('\n', '').replaceAll('\t', '').replaceAll(' ', '');
              if (funcTest == '' || funcTest == ')') {
                continue;
              }

              let exportPath = null;
              let idx = null;
              let functionName = null;
              let varFileName = null;
              let refFuncInParam = null;
              const rexRequire = /\s*require\s*\n*\t*\(/;
              if (rexRequire.test(func)) {
                if (
                  func &&
                  func.split(new RegExp('\\(\\s*__dirname\\s*\\+\\s*\\"?\\\'?\\`?')).length > 1
                ) {
                  func = func.replaceAll("'", '"').replaceAll('`', '"');
                  func = func.split(new RegExp('\\(\\s*__dirname\\s*\\+\\s*\\"'));
                  func = func.join('(".');
                }

                /**
                 * CASE: foo.method('/path', require('./pathToFile.js'))
                 */
                exportPath = func.split(rexRequire);
                exportPath = exportPath.slice(-1)[0];
                exportPath = exportPath.split(')')[0];
                if (exportPath && exportPath.includes('./')) {
                  if (exportPath.includes('../')) {
                    const foldersToBack = exportPath.split('../').length - 1;
                    let RelativePathBacked = relativePath.split('/');
                    RelativePathBacked = RelativePathBacked.slice(0, -1 * foldersToBack);
                    RelativePathBacked = RelativePathBacked.join('/');

                    exportPath = `${RelativePathBacked}/${exportPath
                      .replaceAll("'", '')
                      .replaceAll('"', '')
                      .replaceAll('`', '')
                      .replaceAll(' ', '')
                      .replaceAll('\n', '')
                      .replaceAll('../', '')}`;
                  } else {
                    exportPath =
                      relativePath +
                      exportPath
                        .replaceAll("'", '')
                        .replaceAll('"', '')
                        .replaceAll('`', '')
                        .replaceAll(' ', '')
                        .replaceAll('\n', '')
                        .replaceAll('./', '/');
                  }
                }
              } else {
                func = func
                  .replaceAll('\n', '')
                  .replaceAll('\t', '')
                  .replaceAll(' ', '')
                  .replaceAll('[', '')
                  .replaceAll(']', '');

                /**
                 * CASE: awilix-express
                 * const fooFoo = require('./pathToFoo')
                 * ...
                 * router.method('/path', fooFoo('foo') )
                 */
                if (func.includes('(') && func.includes(')')) {
                  const params = await utils.stack0SymbolRecognizer(func, '(', ')'); // TODO: get array with all strings and try to find with each one
                  if (params && (params[0] == '"' || params[0] == "'" || params[0] == '`')) {
                    refFuncInParam = params
                      .replaceAll('"', '')
                      .replaceAll("'", '')
                      .replaceAll('`', '');
                  }
                }
                /* END CASE */

                func = func.split(new RegExp('\\(|\\)'))[0];
                if (
                  func.split(new RegExp('\\(|\\)|\\[|\\]|\\{|\\}|\\!|\\=|\\>|\\<')).length > 1 ||
                  func.trim() == ''
                ) {
                  continue;
                }

                if (func.split('.').length > 1) {
                  // Identifying subfunction reference, such as: 'controller.store' in the foo.get('/path', controller.store)
                  functionName = func.split('.')[1].trim();
                  varFileName = func.split('.')[0].trim();
                } else {
                  varFileName = func.split('.')[0].trim();
                }

                // First, tries to find in the import/require
                idx = importedFiles.findIndex(
                  e => e.varFileName && varFileName && e.varFileName == varFileName,
                );
                if (idx == -1) {
                  // Second, tries to find in the 'exports' of import/require, such as 'foo' in the: import { foo } from './fooFile'
                  importedFiles.forEach(imp => {
                    if (exportPath) {
                      return;
                    }

                    // First, try to find the 'alias'
                    let found =
                      imp && imp.exports
                        ? imp.exports.find(
                            e => e.varAlias && varFileName && e.varAlias == varFileName,
                          )
                        : null;

                    if (!found) {
                      found =
                        imp && imp.exports
                          ? imp.exports.find(
                              e => e.varName && varFileName && e.varName == varFileName,
                            )
                          : null;
                    } else {
                      found.varName = found.varAlias;
                    }
                    if (found) {
                      if (!functionName && !imp.isDirectory) {
                        functionName = found.varName;
                      }
                      imp.isDirectory ? (exportPath = found.path) : (exportPath = imp.fileName); // TODO: change variable name
                    }
                  });
                } else if (importedFiles[idx].isDirectory && !importedFiles[idx].isRequireDirLib) {
                  exportPath = `${importedFiles[idx].fileName}/index`;
                }
              }

              // If found, so is a reference to another file
              if (idx > -1 || exportPath) {
                /**
                 * Bringing reference
                 */
                let pathFile = null;
                if (exportPath) {
                  pathFile = exportPath;
                } else if (
                  importedFiles[idx] &&
                  importedFiles[idx].isRequireDirLib &&
                  func &&
                  func.split('.').length == 3
                ) {
                  functionName = func.split('.')[2].trim();
                  pathFile = `${importedFiles[idx].fileName}/${func.split('.')[1].trim()}`;
                } else {
                  pathFile = importedFiles[idx].fileName;
                }

                let extension = await utils.getExtension(pathFile);
                let refFunction = await functionRecognizerInFile(
                  pathFile + extension,
                  functionName,
                );

                // Trying to find the reference in the index file
                // TODO: implements to 'import' and 'exports.default'
                if (
                  !refFunction &&
                  functionName &&
                  pathFile &&
                  pathFile.split('/').length > 1 &&
                  pathFile.split('/').slice(-1)[0] == 'index'
                ) {
                  const dataIndexFile = await utils.getFileContent(pathFile + extension);
                  if (dataIndexFile) {
                    pathFile = pathFile.split('/').slice(0, -1).join('/'); // removing '/index'
                    const importsIndexFile = await getImportedFiles(dataIndexFile, pathFile);
                    const idx = importsIndexFile.findIndex(
                      e => e.varFileName && functionName && e.varFileName == functionName,
                    );
                    pathFile = null;
                    if (idx == -1) {
                      importsIndexFile.forEach(imp => {
                        if (pathFile) {
                          return;
                        }
                        const found =
                          imp && imp.exports
                            ? imp.exports.find(
                                e => e.varName && functionName && e.varName == functionName,
                              )
                            : null;
                        if (found) {
                          if (!functionName) {
                            functionName = found.varName;
                          }
                          if (imp.isDirectory) {
                            pathFile = found.path;
                          } else {
                            pathFile = imp.fileName; // TODO: change variable name
                          }
                        }
                      });
                    } else {
                      pathFile = importsIndexFile[idx].fileName;
                    }
                    if (pathFile) {
                      extension = await utils.getExtension(pathFile);
                      refFunction = await functionRecognizerInFile(
                        pathFile + extension,
                        functionName,
                      );
                    }
                  }
                }

                if (!refFunction && refFuncInParam) {
                  const fileContent = await utils.getFileContent(pathFile + extension);
                  if (fileContent && fileContent.includes('awilix-express'))
                    refFunction = await functionRecognizerInFile(
                      pathFile + extension,
                      refFuncInParam,
                    );
                }

                /**
                 * CASE: Reference to files in the index.ts
                 * Ref.: issue #32
                 */
                if (!refFunction) {
                  if (!functionName) {
                    let dataIndexFile = await utils.getFileContent(pathFile + extension);
                    if (dataIndexFile) {
                      pathFile = pathFile.split('/').slice(0, -1).join('/'); // removing '/index'

                      /**
                       * 'hidding' imports and catching only exports and
                       * change exports to imports to catched by the getImportedFiles()
                       */
                      dataIndexFile = dataIndexFile.split('import').join('__ignored__');
                      dataIndexFile = dataIndexFile.split('export').join('import');

                      const exportsIndexFile = await getImportedFiles(dataIndexFile, pathFile);
                      const idx = -1;

                      /**
                       * TODO: searching in the varFileName
                       * let idx = exportsIndexFile.findIndex(e => e.varFileName && (e.varFileName == functionName))
                       */

                      pathFile = null;
                      if (idx == -1) {
                        exportsIndexFile.forEach(imp => {
                          if (pathFile) {
                            return;
                          }
                          const found =
                            imp && imp.exports
                              ? imp.exports.find(e => e.varAlias && e.varAlias == 'default')
                              : null;
                          if (found) {
                            pathFile = imp.fileName;
                            if (!functionName) {
                              functionName = found.varName;
                            }
                          }
                        });
                      }
                      if (pathFile) {
                        extension = await utils.getExtension(pathFile);
                        refFunction = await functionRecognizerInFile(
                          pathFile + extension,
                          functionName,
                        );
                      }
                    }
                  } else {
                    // TODO: When functionName is != null
                  }
                }
                /* END CASE */

                if (!refFunction && !functionName) {
                  refFunction = await functionRecognizerInFile(pathFile + extension, varFileName);
                }

                if (predefMethod == 'use' && refFunction) {
                  if (refFunction.split(')')[0].split(',').length > 2) {
                    let isLocalRouteMiddleware = false;
                    if (aData[idxElem].split(new RegExp(regex)).length > 1) {
                      // Verify if is not a local route middleware, such as: route.use(middleware).get(...).post(...)...
                      isLocalRouteMiddleware = true;
                    }
                    routeMiddlewares.push({
                      metadata: func,
                      callbackParameters: null,
                      func: refFunction,
                      middleware: true,
                      path: rawPathResolved === '' ? false : rawPathResolved,
                      isLocalRouteMiddleware,
                      bytePosition,
                    });
                  }
                } else if (refFunction) {
                  refFunction = await handleData.clearData(refFunction);
                  endpointFunctions.push({
                    metadata: func,
                    callbackParameters: null,
                    func: refFunction,
                  });
                } else if (!refFunction && functionName) {
                  endpointFunctions.push({
                    metadata: '',
                    callbackParameters: null,
                    func: '',
                  });
                }
              } else {
                /**
                 * Referenced in the same file
                 */
                let refFunction = await handleData.functionRecognizerInData(aDataRaw, varFileName);
                if (refFunction && refFunction.slice(0, 4) == '([_[') {
                  refFunction = null;
                }
                if (predefMethod == 'use' && refFunction) {
                  if (refFunction.split(')')[0].split(',').length > 2) {
                    let isLocalRouteMiddleware = false;
                    if (aData[idxElem].split(new RegExp(regex)).length > 1) {
                      // Verify if is not a local route middleware, such as: route.use(middleware).get(...).post(...)...
                      isLocalRouteMiddleware = true;
                    }
                    routeMiddlewares.push({
                      metadata: func,
                      callbackParameters: null,
                      func: refFunction,
                      middleware: true,
                      path: rawPathResolved === '' ? false : rawPathResolved,
                      isLocalRouteMiddleware,
                      bytePosition,
                    });
                  }
                } else if (refFunction) {
                  refFunction = await handleData.clearData(refFunction);
                  endpointFunctions.push({
                    metadata: func,
                    callbackParameters: null,
                    func: refFunction,
                  });
                }
              }
            }
          }

          if (predefMethod == 'use') {
            continue;
          }

          /**
           * endpointFunctions: receives the endpoint functions, local middleware and received middlewares
           */
          const localPath = swaggerTags.getPath(elemOrig, true);

          endpointFunctions = [
            ...routeMiddlewares.filter(r => {
              if (r.path === '/*' || r.path === '/') {
                return true;
              }
              if (
                (r.path === false && r.bytePosition < bytePosition) ||
                (localPath && r.path && localPath.split(r.path)[0] === '')
              ) {
                return true;
              }
              return false;
            }),
            ...endpointFunctions,
          ];

          // Getting  'request', 'response' and 'next' parameters in the endpointFunctions
          for (let efIdx = 0; efIdx < endpointFunctions.length; ++efIdx) {
            const ef = endpointFunctions[efIdx];
            const callbackParameters = await handleData.getCallbackParameters(`,${ef.func}`);
            ef.callbackParameters = callbackParameters;
            endpointFunctions[efIdx] = ef;
          }

          if (endpointSwaggers && endpointSwaggers !== '')
            endpointFunctions.push({
              metadata: null,
              callbackParameters: null,
              func: endpointSwaggers,
            });

          // Getting Path
          if (!path) {
            if (elemOrig.includes('#swagger.path')) {
              path = swaggerTags.getPath(elemOrig, true);
            } else {
              if (!rawPathResolved) {
                continue;
              }

              path = pathRoute + routePrefix + rawPathResolved;
              path = path.split('/').map(p => {
                if (p.includes(':')) p = `{${p.replace(':', '')}}`;
                return p;
              });
              path = path.join('/');
              path = path
                .replaceAll('\n', '')
                .replaceAll('\\n', '')
                .replaceAll('\r', '')
                .replaceAll('\\r', '');
            }

            while (path.includes('//')) {
              path = path.replaceAll('//', '/');
            }

            objEndpoint[path] = {};
          }

          // Getting Method
          if (!method) {
            method = swaggerTags.getMethodTag(elemOrig, { filePath });
            if (!method) {
              method = predefMethod;
            }

            // Order
            objEndpoint[path][method] = {};
            objEndpoint[path][method].tags = [];
            objEndpoint[path][method].summary = undefined;
            objEndpoint[path][method].description = '';
            objEndpoint[path][method].operationId = undefined;
            objEndpoint[path][method].consumes = undefined;
            objEndpoint[path][method].produces = undefined;
            objEndpoint[path][method].parameters = [];
            objEndpoint[path][method].responses = {};
            objEndpoint[path][method].security = undefined;

            if (path.includes('_undefined_path_0x'))
              // When the path is not found
              objEndpoint[path][method].tags.push({
                name: 'Endpoints without path or method',
              });
          }

          if (!path || !method) {
            throw console.error("\nError: 'path' or 'method' not found.");
          }

          // Used in logs
          const reference = { filePath, predefPattern, method, path };

          /**
           * Handling all endpoint functions
           */
          if (endpointFunctions && endpointFunctions.length == 0) {
            paths = merge(paths, objEndpoint, {
              arrayMerge: overwriteMerge,
            });
          } else {
            let objInBody = null;
            for (let _idxEF = 0; _idxEF < endpointFunctions.length; ++_idxEF) {
              let endpoint = endpointFunctions[_idxEF].func;

              if (swaggerTags.getIgnoreTag(endpoint)) {
                continue;
              }

              endpoint = endpoint
                .replaceAll('\n', ' ')
                .replaceAll('/*', '\n')
                .replaceAll('*/', '\n')
                .replaceAll(statics.SWAGGER_TAG, `\n${statics.SWAGGER_TAG}`);

              req = null;
              res = null;

              // Geting callback parameters: 'request', 'response' and 'next'
              if (autoMode && !req && !res) {
                if (forced) {
                  res = elemOrig.split(/([a-zA-Z]*|[0-9]|_|-)*\.status\(/);
                  if (res[1] && res[1] != '') {
                    res = res[1];
                  } else {
                    res = null;
                  }
                } else {
                  const { callbackParameters } = endpointFunctions[_idxEF];
                  if (callbackParameters) {
                    req = callbackParameters.req;
                    res = callbackParameters.res;
                  }
                }
              }

              if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.auto`)) {
                autoMode = swaggerTags.getAutoTag(endpoint);
              }
              if (autoMode && Object.entries(objParameters).length == 0) {
                // Checking parameters in the path
                objParameters = await handleData.getPathParameters(path, objParameters);
              }
              if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.operationId`)) {
                objEndpoint[path][method].operationId = swaggerTags.getOperationId(
                  endpoint,
                  reference,
                );
              }
              if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.summary`)) {
                objEndpoint[path][method].summary = swaggerTags.getSummary(endpoint, reference);
              }
              if (
                endpoint &&
                endpoint.includes(`${statics.SWAGGER_TAG}.parameters`) &&
                endpoint.includes('[') &&
                endpoint.includes(']')
              ) {
                objParameters = await swaggerTags.getParametersTag(
                  endpoint,
                  objParameters,
                  reference,
                );
              }
              if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.requestBody`)) {
                objEndpoint[path][method].requestBody = await swaggerTags.getRequestBodyTag(
                  endpoint,
                  reference,
                );
              }
              if (!swaggerTags.getOpenAPI()) {
                if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.produces`)) {
                  objEndpoint[path][method].produces = await swaggerTags.getProducesTag(
                    endpoint,
                    reference,
                  );
                }
                if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.consumes`)) {
                  objEndpoint[path][method].consumes = await swaggerTags.getConsumesTag(
                    endpoint,
                    reference,
                  );
                }
              }
              if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.responses`)) {
                objResponses = await swaggerTags.getResponsesTag(endpoint, objResponses, reference);
              }
              if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.description`)) {
                objEndpoint[path][method].description = swaggerTags.getDescription(
                  endpoint,
                  reference,
                );
              }
              if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.tags`)) {
                objEndpoint[path][method].tags = swaggerTags.getTags(endpoint, reference);
              }
              if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.security`)) {
                objEndpoint[path][method].security = await swaggerTags.getSecurityTag(
                  endpoint,
                  reference,
                );
              }
              if (endpoint && endpoint.includes(`${statics.SWAGGER_TAG}.deprecated`)) {
                objEndpoint[path][method].deprecated = swaggerTags.getDeprecatedTag(
                  endpoint,
                  reference,
                );
              }

              if (objResponses === false || objParameters === false || objEndpoint === false)
                return resolve(false);

              if (autoMode && endpoint && ((req && req.length > 0) || (res && res.length > 0))) {
                const hasOwnProperties = endpoint.split(
                  new RegExp('\\s*\\.\\s*hasOwnProperty\\s*\\('),
                );
                if (hasOwnProperties && hasOwnProperties.length > 1) {
                  hasOwnProperties.shift();
                  hasOwnProperties.forEach(h => {
                    let varName = h
                      .replaceAll('"', '')
                      .replaceAll("'", '')
                      .replaceAll('`', '')
                      .replaceAll(' ', '');
                    varName = `.${varName.split(')')[0]}`;
                    endpoint = endpoint.replace(
                      new RegExp('\\s*\\.\\s*hasOwnProperty\\s*\\('),
                      varName,
                    );
                  });
                }

                endpoint = await handleData.removeStrings(endpoint); // Avoiding .status(...) in string
                endpoint = endpoint.replaceAll('__¬¬¬__', '"');
                if (req) {
                  objParameters = handleData.getHeaderQueryBody(endpoint, req, objParameters); // Search for parameters in the query and body
                  if (method === 'get' && objParameters.__obj__in__body__) {
                    delete objParameters.__obj__in__body__;
                  }
                  objParameters = handleData.getQueryIndirectly(endpoint, req, objParameters); // Search for parameters in the query (indirectly)
                  if (objParameters.__obj__in__body__) {
                    if (!objInBody) {
                      objInBody = objParameters.__obj__in__body__;
                    } else if (
                      objInBody.schema &&
                      objInBody.schema.properties &&
                      objParameters.__obj__in__body__.schema &&
                      objParameters.__obj__in__body__.schema.properties
                    ) {
                      objInBody.schema.properties = {
                        ...objInBody.schema.properties,
                        ...objParameters.__obj__in__body__.schema.properties,
                      };
                    }
                    delete objParameters.__obj__in__body__;
                  }
                }
                if (res) {
                  objResponses = handleData.getStatus(endpoint, res, objResponses); // Search for response status
                  objEndpoint = handleData.getHeader(endpoint, path, method, res, objEndpoint); // Search for resonse header
                }
              }

              Object.values(objParameters).forEach(objParam => {
                if (objEndpoint[path][method].parameters) {
                  const idxFound = objEndpoint[path][method].parameters.findIndex(
                    e => e.name === objParam.name && e.in === objParam.in,
                  );
                  if (objParam.name) {
                    objParam.name = objParam.name.split('__[__[__')[0];
                  }
                  if (idxFound > -1) {
                    objEndpoint[path][method].parameters[idxFound] = objParam;
                  } else {
                    objEndpoint[path][method].parameters.push(objParam);
                  }
                }
              });
              objEndpoint[path][method].responses = objResponses;

              /**
               * If OpenAPI is enabled, convert body parameters to requestBody
               */
              if (
                swaggerTags.getOpenAPI() &&
                objInBody &&
                objInBody.schema &&
                objEndpoint[path][method] &&
                !objEndpoint[path][method].requestBody
              ) {
                objEndpoint[path][method].requestBody = {
                  content: {
                    'application/json': { schema: objInBody.schema },
                  },
                };
                if (
                  objEndpoint[path][method].parameters &&
                  objEndpoint[path][method].parameters.length > 0
                ) {
                  objEndpoint[path][method].parameters = objEndpoint[path][
                    method
                  ].parameters.filter(p => p.in && p.in.toLowerCase() !== 'body');
                }
                if (objEndpoint[path][method].parameters.length === 0) {
                  delete objEndpoint[path][method].parameters;
                }
                if (objEndpoint[path][method].tags && objEndpoint[path][method].tags.length == 0) {
                  delete objEndpoint[path][method].tags;
                }
                if (objEndpoint[path][method].description == '') {
                  delete objEndpoint[path][method].description;
                }
              } else if (objInBody && _idxEF == endpointFunctions.length - 1) {
                /**
                 * If #swagger.parameter or #swagger.requestBody is present
                 * the automatic body recognition will be ignored.
                 */
                objInBody.name = 'obj'; // By default, the name of object recognized automatically in the body will be 'obj' if no parameter are found to be concatenate with it.
                if (
                  objEndpoint[path][method].parameters &&
                  objEndpoint[path][method].parameters.length > 0 &&
                  objEndpoint[path][method].parameters.find(e => e.in === 'body')
                ) {
                  const body = objEndpoint[path][method].parameters.find(e => e.in === 'body');
                  if (
                    objInBody &&
                    objInBody.schema &&
                    body &&
                    body.schema &&
                    body.schema.properties &&
                    body.schema.properties.__AUTO_GENERATE__ &&
                    Object.keys(body.schema.properties).length == 0
                  ) {
                    delete body.schema;
                  }

                  if (
                    body &&
                    body.schema &&
                    body.schema.properties &&
                    body.schema.properties.__AUTO_GENERATE__
                  ) {
                    delete body.schema;
                  }

                  if (
                    body &&
                    !body.schema &&
                    (!body.type || (body.type && body.type.toLowerCase() == 'object'))
                  ) {
                    objEndpoint[path][method].parameters[0] = {
                      ...objInBody,
                      ...body,
                    };
                  }
                } else if (objEndpoint[path][method] && !objEndpoint[path][method].requestBody) {
                  objEndpoint[path][method].parameters.push(objInBody);
                }
              }

              const { parameters } = objEndpoint[path][method];
              if (parameters && parameters.length > 0) {
                objEndpoint[path][method].parameters = parameters.map(p => {
                  if (p.schema && p.schema.properties && p.schema.properties.__AUTO_GENERATE__) {
                    p.schema.properties = {};
                  }
                  return p;
                });
              }

              delete objEndpoint[path][method].path;
              delete objEndpoint[path][method].method;
              if (path.includes('/')) {
                if (paths[path]) {
                  // Allow get, post, etc, in same path
                  paths[path] = {
                    ...paths[path],
                    ...objEndpoint[path],
                  };
                } else {
                  paths = {
                    ...paths,
                    ...objEndpoint,
                  };
                }
              }
            }
          }
        }
      }

      let allPaths = {};
      if (aRoutes && aRoutes.length >= 1) {
        for (let file = 0; file < aRoutes.length; file++) {
          const rt = aRoutes[file];
          if (rt.split(']_])').length < 3) {
            continue;
          }

          let refFunc = null;
          const obj = {
            path: null,
            varFileName: null,
            middleware: null,
            fileName: null,
            isDirectory: null,
          };
          let data = rt.split(']_])(');
          const routeName = data[1].split('[_[')[1].trim();
          let bytePosition = parseInt(data[2].split('[_[')[1]);

          data = await utils.stackSymbolRecognizer(data[3], '(', ')');

          const routeFound = propRoutes.find(r => r.routeName === routeName);
          if (routeFound) {
            routePrefix = routeFound.prefix || '';
          } else {
            routePrefix = '';
          }

          let exportPath = null;
          const rexRequire = /\s*require\s*\n*\t*\(/;
          if (rexRequire.test(data)) {
            if (
              data &&
              data.split(new RegExp('\\(\\s*__dirname\\s*\\+\\s*\\"?\\\'?\\`?')).length > 1
            ) {
              data = data.replaceAll("'", '"').replaceAll('`', '"');
              data = data.split(new RegExp('\\(\\s*__dirname\\s*\\+\\s*\\"'));
              data = data.join('(".');
            }

            /**
             * CASE: foo.use(require('./routes.js'))
             */
            exportPath = data.split(rexRequire);
            exportPath = exportPath.slice(-1)[0];
            exportPath = exportPath.split(')')[0];
            if (exportPath && exportPath.includes('./')) {
              if (exportPath.includes('../')) {
                const foldersToBack = exportPath.split('../').length - 1;
                let RelativePathBacked = relativePath.split('/');
                RelativePathBacked = RelativePathBacked.slice(0, -1 * foldersToBack);
                RelativePathBacked = RelativePathBacked.join('/');

                exportPath = `${RelativePathBacked}/${exportPath
                  .replaceAll("'", '')
                  .replaceAll('"', '')
                  .replaceAll('`', '')
                  .replaceAll(' ', '')
                  .replaceAll('\n', '')
                  .replaceAll('../', '')}`;
              } else {
                exportPath =
                  relativePath +
                  exportPath
                    .replaceAll("'", '')
                    .replaceAll('"', '')
                    .replaceAll('`', '')
                    .replaceAll(' ', '')
                    .replaceAll('\n', '')
                    .replaceAll('./', '/');
              }
              obj.hasRequire = true;
              const isDirectory = !!(
                fs.existsSync(exportPath) && fs.lstatSync(exportPath).isDirectory()
              );
              if (isDirectory) {
                obj.isDirectory = true;
                // TODO: Verify other cases
                exportPath += '/index';
              }
            }
          }

          let rawPath = codeParser.getUntil(data, ',');
          let rawPathResolved = null;

          // TODO: Variable in other file
          if (
            rawPath &&
            rawPath.includes('.') &&
            importedFiles.find(
              e =>
                e.varFileName &&
                rawPath.split('.')[0].trim() &&
                e.varFileName == rawPath.split('.')[0].trim(),
            )
          ) {
            // let functionName = rawPath.split('.')[1].trim();
            const varFileName = rawPath.split('.')[0].trim();

            const found = importedFiles.find(
              e => e.varFileName && varFileName && e.varFileName == varFileName,
            );
            if (found) {
              // Variable in other file
              const extension = await utils.getExtension(found.fileName);
              let content = await utils.getFileContent(found.fileName + extension);
              if (content) {
                // Try to find the variable
                content = await handleData.removeComments(content);
                const jsParsedContent = await codeParser.jsParserEsModule(content);
                if (jsParsedContent && jsParsedContent.variables.length > 0) {
                  const found = jsParsedContent.variables.filter(
                    v => v.name == rawPath.split('.')[1],
                  );
                  if (found && found[0] && found[0].end) {
                    bytePosition = found[0].end;
                    rawPathResolved = await codeParser.resolvePathVariables(
                      rawPath.split('.')[1],
                      bytePosition,
                      jsParsedContent,
                      importedFiles,
                    );
                    data = data.replace(rawPath, ''); // removing path
                  }
                }
              }
            }
          }

          if (
            (rawPath && rawPath.includes(')') && !rawPath.split(')')[0].includes('(')) ||
            rawPath == data
          ) {
            // has no path
            rawPath = false;
          } else if (!rawPathResolved) {
            rawPathResolved = await codeParser.resolvePathVariables(
              rawPath,
              bytePosition,
              jsParsed,
              importedFiles,
            );
            data = data.replace(rawPath, ''); // removing path
          }

          let listOfFileName = new Set();
          let dataAux = await handleData.removeComments(data, false);
          dataAux = await handleData.removeStrings(dataAux);
          dataAux = await handleData.removeInsideParentheses(dataAux, true);
          dataAux = dataAux.split(',');
          for (let idx = 0; idx < dataAux.length; ++idx) {
            const param = dataAux[idx];
            if (param && param.trim()[0] != '(' && !rexRequire.test(param) && param.includes(')')) {
              const functionName = param.split(')')[0];
              const functionArguments = await utils.stackSymbolRecognizer(
                data.split(functionName)[1],
                '(',
                ')',
              );
              data = data.replace(functionArguments, ')');
              data = data.replaceAll('()', '');
            }
          }

          if (data.split(',').length == 1) {
            // route with 1 parameter, such as: route.use(middleware)
            if (
              data &&
              rt &&
              rt.split(data)[0] &&
              rt.split(data)[0].split(new RegExp(regex)).length > 1
            ) {
              continue;
            }

            obj.path = '';
            obj.varFileName = data;
            obj.varFileName = obj.varFileName
              .replaceAll('(', '')
              .replaceAll(')', '')
              .replaceAll(' ', '');
            listOfFileName.add(obj.varFileName);
            if (obj.hasRequire && routePrefix) {
              // TODO: Verify other cases
              obj.path = '';
            } else {
              obj.path = pathRoute + routePrefix + obj.path;
            }
            obj.path = obj.path
              .replaceAll('////', '/')
              .replaceAll('///', '/')
              .replaceAll('//', '/');
          } else {
            obj.path = rawPathResolved;

            if (obj.hasRequire && routePrefix) {
              // TODO: Verify other cases
              obj.path = '';
            } else {
              obj.path = pathRoute + routePrefix + obj.path;
            }
            obj.path = obj.path
              .replaceAll('////', '/')
              .replaceAll('///', '/')
              .replaceAll('//', '/');

            if (data.trim()[0] === ',' && (await utils.stack0SymbolRecognizer(data, '[', ']'))) {
              /**
               * Multiple express Routers under the same name space
               * Issue: 61
               */
              let auxOfFileName = await utils.stack0SymbolRecognizer(data, '[', ']');
              if (auxOfFileName) {
                auxOfFileName = auxOfFileName.replaceAll(' ', '').split(',');
              }
              listOfFileName = new Set(auxOfFileName);
            } else {
              obj.varFileName = data.split(',').slice(-1)[0];
              listOfFileName.add(obj.varFileName);
            }

            listOfFileName = [...listOfFileName];
            for (let idxFileName = 0; idxFileName < listOfFileName.length; ++idxFileName) {
              /**
               * CASE:
               * import fooFoo from "./pathToFoo";
               * ...
               * router.use("/", new fooFoo().foo);
               */
              if (listOfFileName[idxFileName].split(new RegExp('new\\s+')).length > 1) {
                if (listOfFileName[idxFileName].slice(-1)[0] == ')') {
                  listOfFileName[idxFileName] = listOfFileName[idxFileName].slice(0, -1);
                }
                listOfFileName[idxFileName] = listOfFileName[idxFileName].split(
                  new RegExp('\\s*new\\s+'),
                )[1];
                if (listOfFileName[idxFileName].split(new RegExp('\\([\\s|\\S]*\\)')).length > 1) {
                  listOfFileName[idxFileName] = listOfFileName[idxFileName].split(
                    new RegExp('\\([\\s|\\S]*\\)'),
                  );
                  listOfFileName[idxFileName] = listOfFileName[idxFileName].join('');
                }
                if (listOfFileName[idxFileName].includes('.')) {
                  refFunc = listOfFileName[idxFileName].split('.')[1];
                  listOfFileName[idxFileName] = listOfFileName[idxFileName].split('.')[0];
                }
              }
              /* END CASE */

              listOfFileName[idxFileName] = listOfFileName[idxFileName]
                .replaceAll('(', '')
                .replaceAll(')', '')
                .replaceAll(' ', '');
              if (refFunc) {
                refFunc = refFunc.replaceAll('(', '').replaceAll(')', '').replaceAll(' ', '');
              }
            }
          }

          listOfFileName = [...listOfFileName];
          for (let idxFileName = 0; idxFileName < listOfFileName.length; ++idxFileName) {
            obj.varFileName = listOfFileName[idxFileName];

            if (
              obj.varFileName &&
              obj.varFileName.split(new RegExp('\\:|\\;|\\=|\\>|\\<|\\{|\\}|\\(|\\)|\\[|\\]|\\,'))
                .length > 1
            ) {
              obj.varFileName = null;
            }

            if (
              refFunc &&
              refFunc.split(new RegExp('\\:|\\;|\\=|\\>|\\<|\\{|\\}|\\(|\\)|\\[|\\]|\\,')).length >
                1
            ) {
              refFunc = null;
            }

            if (exportPath) {
              obj.varFileName = exportPath;
            }

            // First, tries to find in the import/require
            let idx = importedFiles.findIndex(
              e => e.varFileName && obj.varFileName && e.varFileName == obj.varFileName,
            );

            if (idx == -1 && !exportPath) {
              // Second, tries to find in the 'exports' of import/require, such as 'foo' in the: import { foo } from './fooFile'
              importedFiles.forEach((imp, importIdx) => {
                if (exportPath) {
                  return;
                }
                const found =
                  imp && imp.exports
                    ? imp.exports.find(
                        e => e.varName && obj.varFileName && e.varName == obj.varFileName,
                      )
                    : null;
                if (found) {
                  if (imp.isDirectory && found.path) {
                    exportPath = found.path;
                    idx = importIdx;
                  } else if (imp.isDirectory && !found.path) {
                    exportPath = imp.fileName;
                    idx = importIdx;
                  } else {
                    exportPath = imp.fileName; // TODO: change variable name
                  }
                }
              });
            }

            if (
              idx == -1 &&
              !exportPath &&
              obj &&
              obj.varFileName &&
              obj.varFileName.includes('.')
            ) {
              const functionName = obj.varFileName.split('.')[1].trim();
              const varFileName = obj.varFileName.split('.')[0].trim();

              const found = importedFiles.find(
                e => e.varFileName && varFileName && e.varFileName == varFileName,
              );
              if (found) {
                const extension = await utils.getExtension(found.fileName);
                const content = await utils.getFileContent(found.fileName + extension);
                if (content) {
                  // Trying to find the 'router' variable
                  const varRouteFound = content
                    .split(new RegExp('(const|let|var)(\\s+\\w+\\s*\\=\\s*Router\\(\\))'))
                    .find(e => e.replaceAll(' ', '').includes('=Router()'));
                  if (varRouteFound && varRouteFound.split('=')[0].trim() == functionName) {
                    exportPath = found.fileName;
                  }
                }
              }
            }

            if (idx > -1 || exportPath) {
              let pathFile = null;
              if (exportPath) {
                pathFile = exportPath;
              } else {
                pathFile = importedFiles[idx].fileName;
              }

              obj.routeMiddlewares = routeMiddlewares.filter(r => {
                if (r.bytePosition == bytePosition) {
                  return true;
                }

                if (r.path === false && r.bytePosition < bytePosition) {
                  return true;
                }

                // if ((r.path !== false) && (r.path === obj.path) || (r.fixedRoute === true))  // TODO: verify 'fixedRoute'
                if (
                  r.path !== false &&
                  r.path &&
                  obj.path &&
                  r.path.split(obj.path)[0] === '' &&
                  r.bytePosition < bytePosition
                ) {
                  return true;
                }

                return false;
              });

              obj.fileName = pathFile;
              let auxRelativePath = obj.fileName.split('/');
              auxRelativePath.pop();
              auxRelativePath = auxRelativePath.join('/');

              if (exportPath && importedFiles[idx] && importedFiles[idx].isDirectory) {
                const resp = await utils.fileOrDirectoryExist(exportPath);
                if (resp && resp.isDirectory) {
                  const extension = await utils.getExtension(`${obj.fileName}/index`);
                  const realFile = await utils.fileOrDirectoryExist(
                    `${obj.fileName}/index${extension}`,
                  );
                  if (realFile.isFile) {
                    exportPath = null;
                  }
                }
              }

              if (idx > -1 && importedFiles[idx] && importedFiles[idx].isDirectory && !exportPath) {
                const extension = await utils.getExtension(`${obj.fileName}/index`);
                const auxPaths = await readEndpointFile(
                  `${obj.fileName}/index${extension}`,
                  obj.path || '',
                  obj.fileName,
                  obj.routeMiddlewares,
                  null,
                );
                if (auxPaths) {
                  allPaths = {
                    ...paths,
                    ...allPaths,
                    ...auxPaths,
                  };
                } else {
                  allPaths = {
                    ...paths,
                    ...allPaths,
                  };
                }
              } else {
                let refFunction = null;
                const extension = await utils.getExtension(obj.fileName);

                if (refFunc) {
                  refFunction = await functionRecognizerInFile(obj.fileName + extension, refFunc);
                }

                const auxPaths = await readEndpointFile(
                  obj.fileName + extension,
                  routePrefix + (obj.path || ''),
                  auxRelativePath,
                  obj.routeMiddlewares,
                  refFunction,
                );
                if (auxPaths) {
                  allPaths = merge(paths, allPaths, {
                    arrayMerge: overwriteMerge,
                  });
                  allPaths = merge(allPaths, auxPaths, {
                    arrayMerge: overwriteMerge,
                  });
                } else
                  allPaths = merge(paths, allPaths, {
                    arrayMerge: overwriteMerge,
                  });
              }
            } else {
              allPaths = merge(paths, allPaths, {
                arrayMerge: overwriteMerge,
              });
            }
          }
          if (file == aRoutes.length - 1) {
            return resolve(allPaths);
          }
        }
      }
      return resolve(
        merge(paths, allPaths, {
          arrayMerge: overwriteMerge,
        }),
      );
    });
  });
}

/**
 * Get require/import content.
 * @param {string} data
 * @param {string} relativePath
 */
async function getImportedFiles(data, relativePath) {
  const importedFiles = [];
  try {
    const importeds = data.split(new RegExp(`import`, 'i'));
    let requireds = data
      .replaceAll('\n', ' ')
      .split(new RegExp(`\\s*\\t*const\\s+|\\s*\\t*var\\s+|\\s*\\t*let\\s+`, 'i'));
    requireds = requireds.filter(
      e => e.split(new RegExp(`=\\s*\\t*require\\s*\\t*\\(`, 'i')).length > 1,
    );

    // Such as: import foo, { Foo } from './foo'
    if (importeds && importeds.length > 1) {
      importeds.shift();

      // TODO: refactor this. Pass to outside
      let tsPaths = [];
      let tsconfig = await utils.getFileContent(`${process.cwd()}/tsconfig.json`);
      if (tsconfig) {
        tsconfig = await handleData.removeComments(tsconfig);
        tsconfig = JSON5.parse(tsconfig); // Allow trailing commas
        tsPaths =
          tsconfig.compilerOptions &&
          tsconfig.compilerOptions.paths &&
          typeof tsconfig.compilerOptions.paths === 'object'
            ? Object.entries(tsconfig.compilerOptions.paths)
            : [];
      }

      // Verify if .eslintrc
      let eslintConfig = await utils.getFileContent(`${process.cwd()}/.eslintrc`);
      if (eslintConfig) {
        eslintConfig = await handleData.removeComments(eslintConfig);
        eslintConfig = JSON5.parse(eslintConfig); // Allow trailing commas
        if (
          eslintConfig.settings &&
          eslintConfig.settings['import/resolver'] &&
          eslintConfig.settings['import/resolver']['babel-plugin-root-import']
        ) {
          const rootPath = eslintConfig.settings['import/resolver']['babel-plugin-root-import'];
          const { rootPathPrefix } = rootPath;
          const { rootPathSuffix } = rootPath;
          if (rootPathPrefix && rootPathSuffix) {
            tsPaths.push([rootPathPrefix, [rootPathSuffix]]);
          }
        }
      }

      for (let index = 0; index < importeds.length; ++index) {
        const imp = importeds[index];
        const obj = {
          varFileName: null,
          fileName: null,
          exports: [],
        };
        let varFileName = imp.split(new RegExp(`from`, 'i'))[0].trim();

        if (varFileName) {
          const origVarFileName = varFileName;
          try {
            const instancesRegex = `\\s*\\n*\\t*\\=\\s*\\n*\\t*new\\s+${varFileName}\\s*\\n*\\t*\\(`;
            const instances = data.split(new RegExp(instancesRegex));
            if (instances.length > 1) {
              instances.pop();
              let newVarFileName = '{ ';
              instances.forEach(inst => {
                const instance = inst.split(' ').slice(-1)[0];
                newVarFileName += `${instance}, `;
              });
              newVarFileName += `${varFileName} }`;
              varFileName = newVarFileName;
            }
          } catch (err) {
            varFileName = origVarFileName;
          }

          try {
            let instancesRegex = `\\s*\\n*\\t*\\}\\s*\\n*\\t*\\=\\s*${origVarFileName}\\;?\\s+`;
            let instances = data.replaceAll('\n', ' ').split(new RegExp(instancesRegex));
            if (instances.length > 1) {
              instances.pop();
              let newVarFileName = '{ ';
              instances.forEach(inst => {
                const vars = inst.split('{').slice(-1)[0];
                newVarFileName += `${vars}, `;
              });
              newVarFileName += `${varFileName} }`;
              varFileName = newVarFileName;
            }

            instancesRegex = `\\s*\\n*\\t*\\s*\\n*\\t*\\=\\s*${origVarFileName}\\;?\\s+`;
            instances = data.replaceAll('\n', ' ').split(new RegExp(instancesRegex));
            if (instances.length > 1) {
              instances.pop();
              let newVarFileName = '{ ';
              instances.forEach(inst => {
                if (inst.trim().slice(-1)[0] == '}') {
                  return;
                }
                const varsName = inst.split(' ').slice(-1)[0];
                newVarFileName += `${varsName}, `;
              });
              newVarFileName += `${varFileName} }`;
              varFileName = newVarFileName;
              varFileName = varFileName
                .replaceAll(' ', '')
                .replaceAll(',{', ',')
                .replaceAll('{{', '{')
                .replaceAll('}}', '}');
            }
          } catch (err) {
            varFileName = origVarFileName;
          }
        }

        if (varFileName.includes('{')) {
          if (varFileName.split(new RegExp(',\\s*\\n*\\t*{')).length > 1) {
            // such as: import foo, { Foo } from './foo'
            obj.varFileName = varFileName.split('{')[0].replaceAll(',', '').trim();
          }
          varFileName = varFileName.replaceAll('\n', '');
          varFileName
            .split('{')[1]
            .split(',')
            .forEach(exp => {
              exp = exp.replaceAll('{', '').replaceAll('}', '').replaceAll(',', '').trim();
              if (exp == '') {
                return;
              }

              if (exp.includes(' as ')) {
                // alias
                obj.exports.push({
                  varName: exp.split(' as ')[0],
                  varAlias: exp.split(' as ')[1],
                  path: null,
                });
              } else {
                obj.exports.push({
                  varName: exp,
                  varAlias: null,
                  path: null,
                });
              }
            });
        } else if (varFileName.includes(' as ')) {
          obj.varFileName = varFileName.split(' as ')[1];
        } else {
          obj.varFileName = varFileName;
        }

        // REFACTOR
        let fileName = imp.split(new RegExp(';|\\n'))[0].trim();
        fileName &&
        fileName.split(new RegExp(' from |\\}\\s*from\\s*\\"?\\\'?\\`?', 'i')).length > 1
          ? (fileName = fileName
              .split(new RegExp(' from |\\}\\s*from\\s*\\"?\\\'?\\`?', 'i'))[1]
              .trim())
          : imp.split(new RegExp(' from |\\}\\s*from\\s*\\"?\\\'?\\`?', 'i')).length > 1
          ? (fileName = imp.split(new RegExp(' from |\\}\\s*from\\s*\\"?\\\'?\\`?', 'i'))[1].trim())
          : fileName;

        fileName = fileName.split(new RegExp('\\n|\\;'))[0].trim();
        fileName = fileName
          .replaceAll("'", '')
          .replaceAll('"', '')
          .replaceAll('`', '')
          .replaceAll(' ', '')
          .replaceAll(';', '')
          .replaceAll('\n', '');

        const pathPattern = fileName.split('/').slice(0, -1).join('/');
        const found = tsPaths.find(p => p[0] && p[0].split('/*')[0] == pathPattern);

        if (found) {
          const refFileName = found[0].split('/*')[0];
          if (Array.isArray(found[1])) {
            let realPath = found[1][0];
            if (realPath) {
              realPath = realPath.replaceAll('/*', '');
              fileName = `./${fileName.replace(new RegExp(`^${refFileName}`), realPath)}`;
              relativePath = relativePath.split('/');
              const rootPath = realPath ? realPath.split('/')[0] : null;
              let rootFound = false;

              relativePath = relativePath.filter(path => {
                if (rootFound) {
                  return false;
                }
                if (path == rootPath) {
                  rootFound = true;
                  return false;
                }
                return true;
              });

              relativePath = relativePath.join('/');
            }
          }
        }

        // Captures only local files

        /**
         * CASE: Cannot resolve import function from absolute path
         * Issue: #50
         */
        if (!fileName.includes('./')) {
          // Checking if is a project file
          const extension = await utils.getExtension(fileName);
          if (fs.existsSync(fileName + extension)) {
            // is a absolute path
            fileName = `./${fileName}`; // TODO: check for possible problems here
            relativePath = '';
          }
        }
        /* END CASE */

        if (fileName.includes('./')) {
          let pathFile = null;
          if (relativePath) {
            // REFACTOR: pass to function
            if (fileName.includes('../')) {
              const foldersToBack = fileName.split('../').length - 1;
              let RelativePathBacked = relativePath.split('/');
              RelativePathBacked = RelativePathBacked.slice(0, -1 * foldersToBack);
              RelativePathBacked = RelativePathBacked.join('/');

              pathFile = `${RelativePathBacked}/${fileName.replaceAll('../', '')}`; // .replaceAll('//', '/')
            } else {
              pathFile = relativePath + fileName.replaceAll('./', '/');
            }
          } else {
            pathFile = fileName;
          }

          obj.fileName = pathFile;
          obj.isDirectory = !!(fs.existsSync(pathFile) && fs.lstatSync(pathFile).isDirectory());

          // Checking if reference is to file
          if (obj.isDirectory && obj.exports.length > 0) {
            const indexExtension = await utils.getExtension(`${pathFile}/index`);
            if (indexExtension != '') {
              // index exist
              const dataFile = await utils.getFileContent(`${pathFile}/index${indexExtension}`);
              if (dataFile) {
                const imports = await getImportedFiles(dataFile, obj.fileName);
                for (let idx = 0; idx < obj.exports.length; ++idx) {
                  const { varName } = obj.exports[idx];
                  const idxFound = imports.findIndex(
                    e =>
                      e.varFileName &&
                      varName &&
                      e.varFileName.toLowerCase() == varName.toLowerCase(),
                  );
                  let exportPath = null;
                  if (idxFound == -1) {
                    imports.forEach(imp => {
                      if (exportPath) {
                        return;
                      }
                      const found =
                        imp && imp.exports
                          ? imp.exports.find(
                              e =>
                                e.varName &&
                                varName &&
                                e.varName.toLowerCase() == varName.toLowerCase(),
                            )
                          : null;
                      if (found) {
                        if (imp.isDirectory) {
                          exportPath = null;
                        } else {
                          exportPath = imp.fileName; // REFECTOR: change variable name
                        }
                      }
                    });

                    if (exportPath) {
                      const extension = await utils.getExtension(exportPath);
                      obj.exports[idx].path = exportPath + extension;
                    }
                  }

                  if (idxFound > -1) {
                    const pathFile = imports[idxFound].fileName;
                    const extension = await utils.getExtension(pathFile);
                    obj.exports[idx].path = pathFile + extension;
                  }
                }
              }
            }
          } else {
            // TODO: reference in the file
          }
          importedFiles.push(obj);
        }
      }
    }

    // Such as: const foo = required('./foo')
    if (requireds && requireds.length > 0) {
      for (let index = 0; index < requireds.length; ++index) {
        const req = requireds[index];
        const obj = {
          varFileName: null,
          fileName: null,
          exports: [],
        };
        let varFileName = req.split(new RegExp(`=\\s*\\t*require\\s*\\t*\\(`, 'i'))[0].trim();

        if (varFileName) {
          // Issue: #18
          const origVarFileName = varFileName;
          try {
            let instancesRegex = `\\s*\\n*\\t*\\}\\s*\\n*\\t*\\=\\s*${origVarFileName}\\;?\\s+`;
            let instances = data.replaceAll('\n', ' ').split(new RegExp(instancesRegex));
            if (instances.length > 1) {
              instances.pop();
              let newVarFileName = '{ ';
              instances.forEach(inst => {
                const vars = inst.split('{').slice(-1)[0];
                newVarFileName += `${vars}, `;
              });
              newVarFileName += `${varFileName} }`;
              varFileName = newVarFileName;
            }

            instancesRegex = `\\s*\\n*\\t*\\s*\\n*\\t*\\=\\s*${origVarFileName}\\;?\\s+`;
            instances = data.replaceAll('\n', ' ').split(new RegExp(instancesRegex));
            if (instances.length > 1) {
              instances.pop();
              let newVarFileName = '{ ';
              instances.forEach(inst => {
                if (inst.trim().slice(-1)[0] == '}') {
                  return;
                }
                const varsName = inst.split(' ').slice(-1)[0];
                newVarFileName += `${varsName}, `;
              });
              newVarFileName += `${varFileName} }`;
              varFileName = newVarFileName;
              varFileName = varFileName
                .replaceAll(' ', '')
                .replaceAll(',{', ',')
                .replaceAll('{{', '{')
                .replaceAll('}}', '}');
            }
          } catch (err) {
            varFileName = origVarFileName;
          }
        }
        if (varFileName.includes('{')) {
          if (varFileName.split(new RegExp(',\\s*\\t*{')).length > 1) {
            // such as: import foo, { Foo } from './foo'
            obj.varFileName = varFileName.split('{')[0].replaceAll(',', '').trim();
          }
          varFileName = varFileName.replaceAll('\n', '');
          varFileName
            .split('{')[1]
            .split(',')
            .forEach(exp => {
              exp = exp.replaceAll('{', '').replaceAll('}', '').replaceAll(',', '').trim();
              if (exp == '') {
                return;
              }

              if (exp && exp.includes(' as ')) {
                // alias
                obj.exports.push({
                  varName: exp.split(' as ')[0],
                  varAlias: exp.split(' as ')[1],
                  path: null,
                });
              } else {
                obj.exports.push({
                  varName: exp,
                  varAlias: null,
                  path: null,
                });
              }
            });
        } else {
          obj.varFileName = varFileName;
        }

        let fileName = req.split(new RegExp(`=\\s*\\t*require\\s*\\t*\\(`, 'i'))[1].trim();
        fileName = fileName.split(')')[0];
        fileName = fileName
          .replaceAll("'", '')
          .replaceAll('"', '')
          .replaceAll('`', '')
          .replaceAll(' ', '');

        // Captures only local files

        /**
         * CASE: Cannot resolve import function from absolute path
         * Issue: #50
         */
        if (!fileName.includes('./')) {
          // Checking if is a project file
          const extension = await utils.getExtension(fileName);
          if (fs.existsSync(fileName + extension)) {
            // is an absolute path
            fileName = `./${fileName}`; // TODO: check for possible problems here
            relativePath = '';
          }
        }
        /* END CASE */

        if (fileName.includes('./')) {
          if (fileName.split(new RegExp(`.json`, 'i')).length == 1) {
            // Will not recognize files with .json extension
            let pathFile = null;
            if (relativePath) {
              // REFACTOR: pass to function
              if (fileName.includes('../')) {
                const foldersToBack = fileName.split('../').length - 1;
                let RelativePathBacked = relativePath.split('/');
                RelativePathBacked = RelativePathBacked.slice(0, -1 * foldersToBack);
                RelativePathBacked = RelativePathBacked.join('/');

                pathFile = `${RelativePathBacked}/${fileName.replaceAll('../', '')}`;
              } else {
                pathFile = relativePath + fileName.replaceAll('./', '/');
              }
            } else {
              pathFile = fileName;
            }

            obj.fileName = pathFile;
            obj.isDirectory = !!(fs.existsSync(pathFile) && fs.lstatSync(pathFile).isDirectory());

            // Checking if reference is to file
            if (obj.isDirectory) {
              const indexExtension = await utils.getExtension(`${pathFile}/index`);
              if (indexExtension != '') {
                // index exist
                let dataFile = await utils.getFileContent(`${pathFile}/index${indexExtension}`);
                dataFile = await handleData.removeComments(dataFile);
                const isRequireDirLib = !!(
                  dataFile &&
                  dataFile.split(
                    new RegExp(
                      '\\s*\\n*\\t*module\\s*\\n*\\t*\\.\\s*\\n*\\t*exports\\s*\\n*\\t*\\=\\s*\\n*\\t*require\\s*\\n*\\t*\\(\\s*\\n*\\t*.require\\-dir.\\s*\\n*\\t*\\)',
                    ),
                  ).length > 1
                );
                if (isRequireDirLib) {
                  // lib require-dir
                  obj.isRequireDirLib = isRequireDirLib;
                } else {
                  // TODO: Verify other cases

                  const relativePath = obj.fileName;
                  obj.exports.map(oExp => {
                    if (
                      dataFile.split(
                        new RegExp(`${oExp}\\s*\\n*\\t*\\=\\s*\\n*\\t*require\\s*\\n*\\t*\\(`),
                      ).length > 1
                    ) {
                      let addPath = dataFile.split(
                        new RegExp(
                          `${oExp}\\s*\\n*\\t*\\=\\s*\\n*\\t*require\\s*\\n*\\t*\\(\\s*\\n*\\t*`,
                        ),
                      );
                      addPath = addPath[1]
                        .split(')')[0]
                        .replaceAll("'", '')
                        .replaceAll('"', '')
                        .replaceAll('`', '');

                      if (addPath.includes('../')) {
                        // REFACTOR: pass to funcion
                        const foldersToBack = addPath.split('../').length - 1;
                        let RelativePathBacked = relativePath.split('/');
                        RelativePathBacked = RelativePathBacked.slice(0, -1 * foldersToBack);
                        RelativePathBacked = RelativePathBacked.join('/');

                        oExp.path = `${RelativePathBacked}/${addPath.replaceAll('../', '')}`;
                      } else {
                        oExp.path = relativePath + addPath.replaceAll('./', '/');
                      }
                    }
                  });
                }
              }
            }
            importedFiles.push(obj);
          }
        }
      }
    }
    return importedFiles;
  } catch (err) {
    return importedFiles;
  }
}

/**
 *  Recognize function in a file.
 * @param {*} filePath file's path.
 * @param {*} functionName
 * @param {*} isRecursive To avoid infinite loop in case of recursion.
 */
function functionRecognizerInFile(filePath, functionName, isRecursive = true) {
  return new Promise(resolve => {
    fs.readFile(filePath, 'utf8', async function (err, data) {
      if (err) {
        return resolve(null);
      }

      try {
        let cleanedData = data;
        cleanedData = await handleData.removeComments(cleanedData, true);
        cleanedData = cleanedData.split(new RegExp('\\s*=\\s*asyncHandler\\s*\\(')); // TODO: Implement method to remove 'fooToRemove' in this case: const|let|var foo = fooToRemove(...). Issue: #56.
        cleanedData = cleanedData.join(' = (');
        cleanedData = cleanedData.replaceAll(' async ', ' ');
        cleanedData = cleanedData.split(new RegExp('\\=\\s*async\\s*\\('));
        cleanedData = cleanedData.join('= (');
        cleanedData = cleanedData.split(new RegExp('\\=\\s*function\\s*\\('));
        cleanedData = cleanedData.join('= (');
        cleanedData = cleanedData.split(new RegExp('\\:\\s*function\\s*\\('));
        cleanedData = cleanedData.join(': (');
        cleanedData = cleanedData.replaceAll(' function ', ' ');

        // REFACTOR: pass to function
        // adding '(' and ')' to arrow functions without '(' and ')', such as: ... async req => {
        if (cleanedData.split(new RegExp('\\s*\\n*\\t*=>\\s*\\n*\\t*').length > 1)) {
          const params = cleanedData.trim().split(new RegExp('\\s*\\n*\\t*=>\\s*\\n*\\t*'));
          for (let idx = 0; idx < params.length - 1; idx += 2) {
            let param = params[idx];
            if (param && param.slice(-1)[0] !== ')') {
              let aux = param.split(new RegExp('\\s|\\n|\\t|\\='));
              aux = aux.slice(-1)[0];
              param = param.split(aux);
              param.pop();
              param = param.join(aux);
              param += `(${aux})`;
              params[idx] = param;
            }
          }
          cleanedData = params.join(' => ');
        }

        cleanedData = cleanedData.split(new RegExp('=>\\s*\\n*\\t*=>'));
        cleanedData = cleanedData.join('=>');

        if (functionName) {
          // When file has more than one exported function
          let funcStr = await handleData.functionRecognizerInData(cleanedData, functionName);

          /**
           * CASE: Referenced function, such as: module.exports = { foo: require('./fooFile').foo } in index file
           * Issue: #29
           */
          if (
            !funcStr &&
            cleanedData &&
            isRecursive === true &&
            filePath &&
            filePath.split('/').length > 1 &&
            filePath.split('/').slice(-1)[0].includes('index.')
          ) {
            let path = null;
            const exports = cleanedData.split(
              new RegExp(`[\\s+|\\{|\\,]${functionName}\\s*\\:\\s*require\\s*\\(`),
            );
            if (exports.length > 1) {
              let exp = exports[1].split(new RegExp('\\,|\\}'))[0];
              exp = exp.split(new RegExp('\\s*\\)\\s*\\.\\s*'));
              path = exp[0]
                .replaceAll('"', '')
                .replaceAll("'", '')
                .replaceAll('`', '')
                .replaceAll(' ', '');
              if (exp.length > 1) {
                functionName = exp[1]
                  .trim()
                  .split(/\(|\)|\{|\}|\[|\]|\/|\\|;|:|!|@|\$|#|=|\?|\+|,|\||&|\*|\t|\n| /)[0]
                  .replaceAll(' ', '');
              } else {
                functionName = null;
              }

              const relativePath = filePath.split('/').slice(0, -1).join('/');
              // REFACTOR: Pass to function
              if (path && path.includes('./')) {
                if (path.includes('../')) {
                  const foldersToBack = path.split('../').length - 1;
                  let RelativePathBacked = relativePath.split('/');
                  RelativePathBacked = RelativePathBacked.slice(0, -1 * foldersToBack);
                  RelativePathBacked = RelativePathBacked.join('/');

                  path = `${RelativePathBacked}/${path
                    .replaceAll("'", '')
                    .replaceAll('"', '')
                    .replaceAll('`', '')
                    .replaceAll(' ', '')
                    .replaceAll('\n', '')
                    .replaceAll('../', '')}`;
                } else {
                  path =
                    relativePath +
                    path
                      .replaceAll("'", '')
                      .replaceAll('"', '')
                      .replaceAll('`', '')
                      .replaceAll(' ', '')
                      .replaceAll('\n', '')
                      .replaceAll('./', '/');
                }
              }

              if (path) {
                const extension = await utils.getExtension(path);
                funcStr = await functionRecognizerInFile(path + extension, functionName, false);
              }
            }
          }
          /* END CASE */

          return resolve(funcStr);
        }
        // When file has only one exported function
        cleanedData = cleanedData.replaceAll('\n', ' ').replaceAll('  ', ' ').replaceAll('  ', ' ');
        if (
          cleanedData.split(new RegExp('export\\s*\\t*default\\s*\\t*\\=*\\s*\\t*\\(.+\\).+\\{'))
            .length > 1
        ) {
          let directPattern = cleanedData.split(
            new RegExp('export\\s*\\t*default\\s*\\t*\\=*\\s*\\t*\\(.+\\).+\\{'),
          );
          if (directPattern.length > 1) directPattern = true;
          else directPattern = false;

          if (directPattern) {
            // Direct declaration in module.exports
            const funcStr = await handleData.functionRecognizerInData(
              cleanedData,
              `export\\s*default`,
            );
            return resolve(funcStr);
          }
          // Indirect declaration in module.exports
          let funcName = cleanedData.split(new RegExp('export\\s*\\n*\\t*default\\s*\\n*\\t*'));
          if (funcName[1]) {
            funcName = funcName[1].split(/\n|\s|\t|;|\{|\}|\(|\)|\[|\]/);
          } else {
            return resolve(null); // TODO: Verify 'null' case
          }
          const funcStr = await handleData.functionRecognizerInData(cleanedData, funcName[0]);
          return resolve(funcStr);
        }
        let directPattern = cleanedData.split(
          new RegExp(
            `module\\s*\\n*\\t*\\.\\s*\\n*\\t*exports\\s*\\n*\\t*\\=*\\s*\\n*\\t*\\(.+\\).+\\{`,
          ),
        );
        if (directPattern.length > 1) {
          directPattern = true;
        } else {
          directPattern = false;
        }

        if (directPattern) {
          // Direct declaration in module.exports
          const funcStr = await handleData.functionRecognizerInData(
            cleanedData,
            `module\\.exports`,
          );
          return resolve(funcStr);
        }
        // Indirect declaration in module.exports
        let funcName = cleanedData.split(
          new RegExp('module\\s*\\n*\\t*\\.\\s*\\n*\\t*exports\\s*\\n*\\t*\\=\\s*\\n*\\t*'),
        );
        if (funcName[1]) {
          funcName = funcName[1].split(/\n|\s|\t|;|\{|\}|\(|\)|\[|\]/);
        } else {
          return resolve(null); // TODO: Verify 'null' case
        }
        const funcStr = await handleData.functionRecognizerInData(cleanedData, funcName[0]);
        return resolve(funcStr);
      } catch (err) {
        return resolve(null);
      }
    });
  });
}

module.exports = {
  readEndpointFile,
};
