/** MAIN AUTHOR:
   Name: Davi Baltar
   Github Link: https://github.com/davibaltar/swagger-autogen 
**/
require('./src/prototype-functions');
const fs = require('fs');
const swaggerTags = require('./src/swagger-tags');
const handleFiles = require('./src/handle-files');
const statics = require('./src/statics');
const utils = require('./src/utils');

const { platform } = process;
const symbols = platform === 'win32' ? { success: '', failed: '' } : { success: '✔', failed: '✖' };

let i = 0;
module.exports = function (args) {
  let options = { language: null, disableLogs: false, disableWarnings: false, openapi: null };
  let recLang = null;
  if (args && typeof args === 'string') {
    // will be deprecated in a future version
    recLang = args;
  } else if (args && typeof args === 'object') {
    options = { ...options, ...args };
  }

  swaggerTags.setLanguage(recLang || options.language || 'en-US');
  swaggerTags.setOpenAPI(options.openapi);
  swaggerTags.setDisableLogs(options.disableLogs);
  /**
   * SemibasePath is based on Penguin routing system.. where every route file returns an object like: { path: '/v1/categories', router: {...} }
   * setApiDefaultBasepath: if it is true then add ('/api') prefix on these path  { path: '/api/v1/categories', router: {...} }
   **/
  return async (outputFile, endpointsFiles, data, semibasePath, setApiDefaultBasepath = false) => {
    try {
      if (!outputFile) throw console.error("\nError: 'outputFile' was not specified.");
      if (!endpointsFiles) throw console.error("\nError: 'endpointsFiles' was not specified.");

      let allFiles = [];
      // Checking if endpoint files exist
      for (let idx = 0; idx < endpointsFiles.length; ++idx) {
        const file = endpointsFiles[idx];
        if (file.includes('*')) {
          const patternPath = await utils.resolvePatternPath(file);
          if (patternPath) {
            for (let idxFile = 0; idxFile < patternPath.length; ++idxFile) {
              const file = patternPath[idxFile];
              const extension = await utils.getExtension(file);

              if (!fs.existsSync(file + extension)) {
                throw console.error(`\nError: File not found: '${file}'`);
              } else {
                patternPath[idxFile] = file + extension;
              }
            }
            allFiles = [...allFiles, ...patternPath];
          }
        } else {
          const extension = await utils.getExtension(file);
          allFiles = [...allFiles, file + extension];
          if (!fs.existsSync(file + extension)) {
            throw console.error(`\nError: File not found: '${file}'`);
          }
        }
      }

      const objDoc = { ...statics.TEMPLATE, ...data, paths: {} };

      if (options.openapi && utils.isNumeric(options.openapi.replaceAll('.', ''))) {
        objDoc.openapi = options.openapi;
      } else {
        objDoc.swagger = '2.0';
      }

      // Removing all null attributes
      for (const key in objDoc) {
        if (objDoc[key] === null) {
          delete objDoc[key];
        }
      }

      if (!objDoc.info.version) {
        objDoc.info.version = statics.TEMPLATE.info.version;
      }
      if (!objDoc.info.title) {
        objDoc.info.title = statics.TEMPLATE.info.title;
      }
      if (!objDoc.info.description) {
        objDoc.info.description = statics.TEMPLATE.info.description;
      }

      for (let file = 0; file < allFiles.length; file++) {
        const filePath = allFiles[file];

        const resp = await fs.existsSync(filePath);
        if (!resp) {
          console.error(`${'\nError: Endpoint file not found => ' + "'"}${filePath}'`);
          if (!options.disableLogs) {
            console.log('Swagger-autogen:', '\x1b[31m', `Failed ${symbols.failed}`, '\x1b[0m');
          }
          return false;
        }

        let relativePath = filePath.split('/');
        if (relativePath.length > 1) {
          relativePath.pop();
          relativePath = relativePath.join('/');
        } else {
          relativePath = null;
        }

        const obj = await handleFiles.readEndpointFile(filePath, '', relativePath, []);
        /**
         * SemibasePath is based on Penguin routing system.. where every route file returns an object like: { path: '/v1/categories', router: {...} }
         * setApiDefaultBasepath: if it is true then add ('/api') prefix on these path  { path: '/api/v1/categories', router: {...} }
         **/
        // TODO:PenguinJS basePath implementaion

        if (semibasePath) {
          for (const key in obj) {
            if (setApiDefaultBasepath) {
              obj[`/api${semibasePath[i].path}${key}`] = obj[key];
            } else {
              obj[semibasePath[i].path + key] = obj[key];
            }
            delete obj[key];
          }
          i++;
        }

        if (obj === false) {
          if (!options.disableLogs) {
            console.log('Swagger-autogen:', '\x1b[31m', `Failed ${symbols.failed}`, '\x1b[0m');
          }
          return false;
        }
        objDoc.paths = { ...objDoc.paths, ...obj };
      }

      let constainXML = false;
      if (JSON.stringify(objDoc).includes('application/xml')) {
        // REFACTOR: improve this
        constainXML = true;
      }
      Object.keys(objDoc.definitions).forEach(definition => {
        if (constainXML) {
          objDoc.definitions[definition] = {
            ...swaggerTags.formatDefinitions(objDoc.definitions[definition], {}, constainXML),
            xml: { name: definition },
          };
        } else {
          objDoc.definitions[definition] = {
            ...swaggerTags.formatDefinitions(objDoc.definitions[definition], {}, constainXML),
          };
        }
      });

      /**
       * Forcing convertion to OpenAPI 3.x
       */
      if (objDoc.openapi) {
        if (objDoc.host) {
          if (objDoc.basePath) {
            objDoc.host += objDoc.basePath;
          }
          if (objDoc.host.slice(0, 4).toLowerCase() != 'http') {
            if (objDoc.schemes && objDoc.schemes.length > 0) {
              objDoc.schemes.forEach(scheme => {
                objDoc.servers.push({
                  url: `${scheme}://${objDoc.host}`,
                });
              });
            } else {
              objDoc.host = `http://${objDoc.host}`;
              objDoc.servers = [
                {
                  url: objDoc.host,
                },
              ];
            }
          }

          delete objDoc.host;
        } else {
          delete objDoc.servers;
        }

        if (objDoc.components && objDoc.components.schemas) {
          Object.keys(objDoc.components.schemas).forEach(schema => {
            // console.log({schema})
            if (constainXML) {
              objDoc.components.schemas[schema] = {
                ...swaggerTags.formatDefinitions(
                  objDoc.components.schemas[schema],
                  {},
                  constainXML,
                ),
                xml: { name: schema },
              };
            } else {
              objDoc.components.schemas[schema] = {
                ...swaggerTags.formatDefinitions(
                  objDoc.components.schemas[schema],
                  {},
                  constainXML,
                ),
              };
            }
          });
        }

        if (objDoc.components && objDoc.components.examples) {
          Object.keys(objDoc.components.examples).forEach(example => {
            if (!objDoc.components.examples[example].value) {
              const auxExample = { ...objDoc.components.examples[example] };
              delete objDoc.components.examples[example];
              objDoc.components.examples[example] = {
                value: auxExample,
              };
            }
          });
        }

        if (objDoc.definitions && Object.keys(objDoc.definitions).length > 0) {
          if (!objDoc.components) {
            objDoc.components = {};
          }
          if (!objDoc.components.schemas) {
            objDoc.components.schemas = {};
          }

          objDoc.components.schemas = {
            ...objDoc.components.schemas,
            ...objDoc.definitions,
          };

          delete objDoc.definitions;
        }

        if (objDoc.securityDefinitions && Object.keys(objDoc.securityDefinitions).length > 0) {
          if (!objDoc.components) {
            objDoc.components = {};
          }
          if (!objDoc.components.securitySchemes) {
            objDoc.components.securitySchemes = {};
          }

          objDoc.components.securitySchemes = {
            ...objDoc.components.securitySchemes,
            ...objDoc.securityDefinitions,
          };

          delete objDoc.securityDefinitions;
        }

        if (objDoc.basePath) {
          delete objDoc.basePath;
        }
        if (objDoc.schemes) {
          delete objDoc.schemes;
        }
        if (objDoc.consumes) {
          delete objDoc.consumes;
        }
        if (objDoc.produces) {
          delete objDoc.produces;
        }
        if (objDoc.definitions) {
          delete objDoc.definitions;
        }
      }

      /**
       * Removing unused parameters
       */
      if (Object.keys(objDoc.components).length == 0) {
        delete objDoc.components;
      }
      if (Object.keys(objDoc.servers).length == 0) {
        delete objDoc.servers;
      }

      const dataJSON = JSON.stringify(objDoc, null, 2);
      if (!fs.existsSync(outputFile)) {
        fs.writeFileSync(outputFile, dataJSON, {
          flag: 'wx',
        });
      } else {
        fs.writeFileSync(outputFile, dataJSON);
      }

      if (!options.disableLogs) {
        console.log('Swagger-autogen:', '\x1b[32m', `Success ${symbols.success}`, '\x1b[0m');
      }
      return { success: true, data: objDoc };
    } catch (err) {
      if (!options.disableLogs) {
        console.log('Swagger-autogen:', '\x1b[31m', `Failed ${symbols.failed}`, '\x1b[0m');
      }
      return { success: false, data: null };
    }
  };
};
