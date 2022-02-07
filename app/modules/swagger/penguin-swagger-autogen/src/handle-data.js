const swaggerTags = require('./swagger-tags');
const statics = require('./statics');
const tables = require('./tables');
const utils = require('./utils');

/**
 * Convert statements such as: "require('./path')(foo)" in "foo.use(require('./path'))"
 * Useful, because the statement "foo.use(require('./path'))" is already handled successfully.
 * @param {string} data file content
 */
function dataConverter(data) {
  return new Promise(resolve => {
    const origData = data;
    try {
      const patterns = new Set();
      // CASE: Converting require("./foo")(app) to app.use(require("./foo"))
      if (!data) {
        return resolve({
          data,
          patterns: [],
        });
      }

      const founds = data.split(
        new RegExp('(require\\s*\\n*\\t*\\(.*\\)\\s*\\n*\\t*\\(\\s*\\n*\\t*.*\\s*\\n*\\t*\\))'),
      );
      for (let idx = 0; idx < founds.length; ++idx) {
        let req = founds[idx];
        if (req.split(new RegExp('^require')).length == 1) continue;

        if (founds[idx - 1] && founds[idx - 1].trim().slice(-1)[0] == '=') {
          // avoiding cases, such as: const foo = require(...)()
          continue;
        }

        req = req.split(new RegExp('require\\s*\\n*\\t*\\(|\\)\\s*\\n*\\t*\\('));
        if (req && (req.length < 2 || !req[1].includes('./') || !req[2])) {
          continue;
        }

        req[2] = req[2].split(')')[0].trim();
        req[2] = req[2].split(',')[0]; // TODO: verify which possition in req[2][0] is a route
        patterns.add(req[2]);

        const converted = `${req[2]}.use(require(${req[1]}))`;
        data = data.replace(founds[idx], converted); // TODO: use replaceAll() ?
      }
      return resolve({
        data,
        patterns: [...patterns],
      });
    } catch (err) {
      return resolve({
        data: origData,
        patterns: [],
      });
    }
  });
}

/**
 * Removes unnecessary content.
 * @param {string} data file content.
 */
function clearData(data) {
  return new Promise(resolve => {
    if (!data) {
      return resolve(data);
    }

    const origData = data;
    try {
      // Change "// ..." comment to "/* ... */"
      const origData = data;
      try {
        data = data
          .split(new RegExp('\\s*\\n*\\t*\\.\\s*\\n*\\t*headers\\s*\\n*\\t*\\[\\s*\\n*\\t*'))
          .join('.headers[');
        data = data.split(
          new RegExp('\\s*\\n*\\t*\\.\\s*\\n*\\t*header\\s*\\n*\\t*\\(\\s*\\n*\\t*'),
        );
        if (data.length > 1) {
          for (let idxHeader = 1; idxHeader < data.length; ++idxHeader) {
            data[idxHeader] = data[idxHeader].replace(')', ']');
          }
          data = data.join('.headers[');
        } else {
          data = data[0];
        }
        data = data
          .split(new RegExp('\\s*\\n*\\t*\\.\\s*\\n*\\t*header\\s*\\n*\\t*\\(\\s*\\n*\\t*'))
          .join('.headers(');
        if (data.split('.headers[').length > 1) {
          data = data.split('.headers[');
          for (let idxHeaders = 1; idxHeaders < data.length; ++idxHeaders) {
            let d = data[idxHeaders];
            if (d[0] === "'" || d[0] === '"' || d[0] === '`') {
              const str = popString(d);
              d = d.replace(
                new RegExp(`.${str}.`),
                `${statics.STRING_QUOTE}${str}${statics.STRING_QUOTE}`,
              );
              data[idxHeaders] = d;
            }
          }
          data = data.join('.headers[');
        }
      } catch (err) {
        data = origData;
      }

      data = data.replaceAll('\r', '\n');
      data = data.replaceAll('\\r', '\n');
      data = data.replaceAll('*//*', '*/\n/*');
      data = data.replaceAll('*//*', '*/\n/*');
      data = data.replaceAll('*///', '*/\n//');
      data = data.replaceAll('///', '//');
      data = data.replaceAll('://', `:/${statics.STRING_BREAKER}/`); // REFACTOR: improve this. Avoiding cases such as: ... http://... be handled as a comment

      data = data.split('//').map((e, idx) => {
        if (idx != 0) {
          return e.replace('\n', ' */ \n');
        }
        return e;
      });
      data = data.join('//').replaceAll('//', '/*');
      data = data.replaceAll(`:/${statics.STRING_BREAKER}/`, '://');

      let aData = data.replaceAll('\n', statics.STRING_BREAKER);
      aData = aData.replaceAll('\t', ' ');

      // Avoiding bug when there is case sensitive and handling symbols ", ' and ` in the header
      aData = aData.split(new RegExp('.\\s*\\t*application/xml\\s*\\t*.', 'i'));
      aData = aData.join('__¬¬¬__application/xml__¬¬¬__');
      aData = aData.split(new RegExp('.\\s*\\t*content-type\\s*\\t*.', 'i'));
      aData = aData.join('__¬¬¬__content-type__¬¬¬__');
      aData = aData.split(new RegExp('.\\s*\\t*application/json\\s*\\t*.', 'i'));
      aData = aData.join('__¬¬¬__application/json__¬¬¬__');

      aData = aData.replaceAll(statics.STRING_BREAKER, '\n');
      aData = aData.replaceAll(' async ', '');
      aData = aData.split(new RegExp('\\s*async\\s*\\('));
      aData = aData.join(' (');
      aData = aData.split(new RegExp('\\:\\s*async\\s*\\('));
      aData = aData.join(': (');
      aData = aData.split(new RegExp('axios\\s*\\n*\\t*\\.\\w*', 'i'));
      aData = aData.join('axios.method');

      aData = aData.split(new RegExp('\\s*\\=\\s*asyncHandler\\s*\\('));
      aData = aData.join(' = ');

      return resolve(aData);
    } catch (err) {
      return resolve(origData);
    }
  });
}

/**
 * Remove comments in a string.
 * @param {string} data file content.
 * @param {boolean} keepSwaggerTags keep comment with "#swagger.*".
 */
function removeComments(data, keepSwaggerTags = false) {
  return new Promise(resolve => {
    if (!data || data.length == 0) {
      return resolve(data);
    }

    let strToReturn = '';
    let stackComment1 = 0; // For type  //
    let stackComment2 = 0; // For type  /* */

    let buffer1 = ''; // For type  //
    let buffer2 = ''; // For type   /* */

    // Won't remove comments in strings
    let isStr1 = 0; // "
    let isStr2 = 0; // '
    let isStr3 = 0; // `
    try {
      for (let idx = 0; idx < data.length; ++idx) {
        const c = data[idx];

        if (stackComment1 == 0 && stackComment2 == 0) {
          // Type '
          if (
            c == "'" &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr1 == 1
          )
            isStr1 = 2;
          if (
            c == "'" &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr1 == 0 &&
            isStr2 == 0 &&
            isStr3 == 0
          )
            isStr1 = 1;

          // Type  "
          if (
            c == '"' &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr2 == 1
          )
            isStr2 = 2;
          if (
            c == '"' &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr1 == 0 &&
            isStr2 == 0 &&
            isStr3 == 0
          )
            isStr2 = 1;

          // Type  `
          if (
            c == '`' &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr3 == 1
          )
            isStr3 = 2;
          if (
            c == '`' &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr1 == 0 &&
            isStr2 == 0 &&
            isStr3 == 0
          )
            isStr3 = 1;
        }

        // Type //
        if (
          c == '/' &&
          data[idx + 1] == '/' &&
          data[idx - 1] != ':' &&
          stackComment1 == 0 &&
          stackComment2 == 0
        )
          // REFACTOR: improve this. Avoiding cases such as: ... http://... be handled as a comment
          stackComment1 = 1;
        if (c == '\n' && stackComment1 == 1) stackComment1 = 2;

        // Type  /* */
        if (
          c == '/' &&
          data[idx + 1] == '*' &&
          stackComment1 == 0 &&
          stackComment2 == 0 &&
          isStr1 == 0 &&
          isStr2 == 0
        )
          stackComment2 = 1;
        if (c == '/' && data[idx - 1] == '*' && stackComment2 == 1 && isStr1 == 0 && isStr2 == 0)
          stackComment2 = 2;

        if (isStr1 > 0 || isStr2 > 0 || (stackComment1 == 0 && stackComment2 == 0)) {
          strToReturn += c;
        } else if (stackComment1 == 1 || stackComment1 == 2) {
          // Keeps the comment being ignored. Like: //
          buffer1 += c;
        } else if (stackComment2 == 1 || stackComment2 == 2) {
          // Keeps the comment being ignored. Like: /* */
          buffer2 += c;
        }

        if (stackComment1 == 2) {
          stackComment1 = 0;
          if (buffer1.includes('#swagger.') && keepSwaggerTags) {
            strToReturn += buffer1; // keeping the comment that has a swagger tag
            buffer1 = '';
          } else buffer1 = '';
        }

        if (stackComment2 == 2) {
          stackComment2 = 0;
          if (buffer2.includes('#swagger.') && keepSwaggerTags) {
            strToReturn += buffer2; // keeping the comment that has a swagger tag
            buffer2 = '';
          } else buffer2 = '';
        }

        if (isStr1 == 2) isStr1 = 0;
        if (isStr2 == 2) isStr2 = 0;
        if (isStr3 == 2) isStr3 = 0;

        if (idx == data.length - 1) {
          strToReturn = strToReturn
            .replaceAll('  ', ' ')
            .replaceAll('  ', ' ')
            .replaceAll('  ', ' ')
            .replaceAll('  ', ' ');
          return resolve(strToReturn);
        }
      }
    } catch (err) {
      return resolve(strToReturn);
    }
  });
}

/**
 * Return all "#swagger.*" in a string.
 * @param {string} data file content.
 */
function getSwaggerComments(data) {
  return new Promise(resolve => {
    if (data.length == 0) {
      return resolve(data);
    }

    let strToReturn = '';
    let stackComment1 = 0; // For type  //
    let stackComment2 = 0; // For type  /* */

    let buffer1 = ''; // For type  //
    let buffer2 = ''; // For type   /* */

    // Won't remove comments in strings
    let isStr1 = 0; // "
    let isStr2 = 0; // '
    let isStr3 = 0; // `

    try {
      for (let idx = 0; idx < data.length; ++idx) {
        const c = data[idx];

        if (stackComment1 == 0 && stackComment2 == 0) {
          // Type '
          if (
            c == "'" &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr1 == 1
          )
            isStr1 = 2;
          if (
            c == "'" &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr1 == 0 &&
            isStr2 == 0 &&
            isStr3 == 0
          )
            isStr1 = 1;

          // Type  "
          if (
            c == '"' &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr2 == 1
          )
            isStr2 = 2;
          if (
            c == '"' &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr1 == 0 &&
            isStr2 == 0 &&
            isStr3 == 0
          )
            isStr2 = 1;

          // Type  `
          if (
            c == '`' &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr3 == 1
          )
            isStr3 = 2;
          if (
            c == '`' &&
            (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
            isStr1 == 0 &&
            isStr2 == 0 &&
            isStr3 == 0
          )
            isStr3 = 1;
        }

        // Type //
        if (c == '/' && data[idx + 1] == '/' && stackComment1 == 0 && stackComment2 == 0)
          stackComment1 = 1;
        if (c == '\n' && stackComment1 == 1) stackComment1 = 2;

        // Type  /* */
        if (c == '/' && data[idx + 1] == '*' && stackComment1 == 0 && stackComment2 == 0)
          stackComment2 = 1;
        if (c == '/' && data[idx - 1] == '*' && stackComment2 == 1) stackComment2 = 2;

        if (stackComment1 == 1 || stackComment1 == 2) {
          // Keeps the comment being ignored. Like: //
          buffer1 += c;
        } else if (stackComment2 == 1 || stackComment2 == 2) {
          // Keeps the comment being ignored. Like: /* */
          buffer2 += c;
        }

        if (stackComment1 == 2) {
          stackComment1 = 0;
          if (buffer1.includes('#swagger.')) {
            strToReturn += ` ${buffer1}`; // keeping the comment that has a swagger tag
            buffer1 = '';
          } else {
            buffer1 = '';
          }
        }

        if (stackComment2 == 2) {
          stackComment2 = 0;
          if (buffer2.includes('#swagger.')) {
            strToReturn += ` ${buffer2}`; // keeping the comment that has a swagger tag
            buffer2 = '';
          } else {
            buffer2 = '';
          }
        }

        if (isStr1 == 2) isStr1 = 0;
        if (isStr2 == 2) isStr2 = 0;
        if (isStr3 == 2) isStr3 = 0;

        if (idx == data.length - 1) {
          strToReturn = strToReturn
            .replaceAll('  ', ' ')
            .replaceAll('  ', ' ')
            .replaceAll('  ', ' ')
            .replaceAll('  ', ' ');
          return resolve(strToReturn);
        }
      }
    } catch (err) {
      return resolve(strToReturn);
    }
  });
}

/**
 * Remove all strings.
 * @param {string} data file content.
 */
function removeStrings(data) {
  return new Promise(resolve => {
    if (!data || data.length == 0) {
      return resolve(data);
    }

    let strToReturn = '';
    let stackStr1 = 0; // For type  '
    let stackStr2 = 0; // For type  "
    let stackStr3 = 0; // For type  `

    try {
      for (let idx = 0; idx < data.length; ++idx) {
        const c = data[idx];

        // Type '
        if (
          c == "'" &&
          (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
          stackStr1 == 1
        )
          stackStr1 = 2;
        if (
          c == "'" &&
          (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
          stackStr1 == 0 &&
          stackStr2 == 0 &&
          stackStr3 == 0
        )
          stackStr1 = 1;

        // Type  "
        if (
          c == '"' &&
          (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
          stackStr2 == 1
        )
          stackStr2 = 2;
        if (
          c == '"' &&
          (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
          stackStr1 == 0 &&
          stackStr2 == 0 &&
          stackStr3 == 0
        )
          stackStr2 = 1;

        // Type  `
        if (
          c == '`' &&
          (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
          stackStr3 == 1
        )
          stackStr3 = 2;
        if (
          c == '`' &&
          (data[idx - 1] != '\\' || (data[idx - 1] == '\\' && data[idx - 2] == '\\')) &&
          stackStr1 == 0 &&
          stackStr2 == 0 &&
          stackStr3 == 0
        )
          stackStr3 = 1;

        if (stackStr1 == 0 && stackStr2 == 0 && stackStr3 == 0) {
          strToReturn += c;
        }

        if (stackStr1 == 2) stackStr1 = 0;
        if (stackStr2 == 2) stackStr2 = 0;
        if (stackStr3 == 2) stackStr3 = 0;

        if (idx == data.length - 1) {
          strToReturn = strToReturn
            .replaceAll('  ', ' ')
            .replaceAll('  ', ' ')
            .replaceAll('  ', ' ')
            .replaceAll('  ', ' ');
          return resolve(strToReturn);
        }
      }
    } catch (err) {
      return resolve(strToReturn);
    }
  });
}

/**
 * Remove all content in parentheses.
 * @param {string} data file content.
 * @param {boolean} keepParentheses if true, keep the parentheses "()" after erasing the contents inside.
 * @param {number} level remove according to stack level
 */
function removeInsideParentheses(data, keepParentheses = false, level = 0) {
  return new Promise(resolve => {
    if (data.length == 0) {
      return resolve(data);
    }

    let strToReturn = '';
    let stack = 0;
    let buffer = '';

    try {
      for (let idx = 0; idx < data.length; ++idx) {
        const c = data[idx];

        if (c == '(') {
          stack += 1;
          if (keepParentheses) {
            buffer += '(';
          }
        }

        if (stack == level) {
          strToReturn += c;
        }
        if (stack == 1) {
          buffer += c;
        }

        if (c == ')') {
          stack -= 1;
          if (keepParentheses) {
            buffer += ')';
          }
          if (stack == level) {
            let auxIdx = idx + 1;
            let validChar = null;

            while (validChar == null && auxIdx <= data.length) {
              if (data[auxIdx] != ' ' && data[auxIdx] != '\n' && data[auxIdx] != '\t') {
                validChar = data[auxIdx];
              }
              auxIdx += 1;
            }

            if (validChar == '(') {
              /**
               * Recognize middlewares in parentheses
               * Issue: #67
               */
              strToReturn += buffer;
            }
            buffer = '';
          }
          if (stack == level && keepParentheses) {
            strToReturn += '()';
          }
        }

        if (idx == data.length - 1) {
          return resolve(strToReturn);
        }
      }
    } catch (err) {
      return resolve(strToReturn);
    }
  });
}

/**
 * Add "([_[method]_])([_[foo]_])([_[index]_])" to all endpoints. This standardize each endpoint.
 *
 * 'method': get, post, put, etc.
 *
 * 'foo': app, route, etc.
 *
 * 'index': id
 *
 * @param {string} data file content.
 * @param {array} patterns array containing patterns recognized as: app, route, etc.
 */
function addReferenceToMethods(data, patterns) {
  return new Promise(resolve => {
    if (!data) {
      return resolve(data);
    }

    let auxData = data;
    const routeEndpoints = [];

    const origData = data;
    try {
      // CASE: router.route('/user').get(authorize, (req, res) => {
      const aDataRoute = auxData.split(
        new RegExp(`.*\\s*\\n*\\t*\\.\\s*\\n*\\t*route\\s*\\n*\\t*\\(`),
      );
      if (aDataRoute.length > 1) {
        for (let idx = 1; idx < aDataRoute.length; ++idx) {
          // CASE: app.get([_[get]_])('/automatic1/users/:id', (req, res) => {
          for (let mIdx = 0; mIdx < statics.METHODS.length; ++mIdx) {
            const method = statics.METHODS[mIdx];
            const line = aDataRoute[idx].split(
              new RegExp(`\\)(\\s*|\\n*|\\t*)\\.\\s*\\n*\\t*${method}\\s*\\n*\\t*\\(`),
            );
            if (line.length === 3) {
              line[0] = line[0].split(')')[0];
              // TODO: refactor this
              line[2] = line[2].split(
                new RegExp(
                  `\\)(\\s*|\\n*|\\t*)\\.\\s*\\n*\\t*get\\s*\\n*\\t*\\(|` +
                    `\\)(\\s*|\\n*|\\t*)\\.\\s*\\n*\\t*head\\s*\\n*\\t*\\(|` +
                    `\\)(\\s*|\\n*|\\t*)\\.\\s*\\n*\\t*post\\s*\\n*\\t*\\(|` +
                    `\\)(\\s*|\\n*|\\t*)\\.\\s*\\n*\\t*put\\s*\\n*\\t*\\(|` +
                    `\\)(\\s*|\\n*|\\t*)\\.\\s*\\n*\\t*delete\\s*\\n*\\t*\\(|` +
                    `\\)(\\s*|\\n*|\\t*)\\.\\s*\\n*\\t*patch\\s*\\n*\\t*\\(|` +
                    `\\)(\\s*|\\n*|\\t*)\\.\\s*\\n*\\t*options\\s*\\n*\\t*\\(`,
                ),
              )[0];
              routeEndpoints.push(`${patterns[0] || '_app'}.${method}(${line[0]},${line[2]}`);
            }
          }
        }
        auxData = aDataRoute[0] + routeEndpoints.join('\n');
      }

      /**
       * CASE: router.get(...).post(...).put(...)...
       */
      let regexChainedEndpoint = '';
      for (let idxMethod = 0; idxMethod < statics.METHODS.length; ++idxMethod) {
        regexChainedEndpoint += `(\\)\\s*\\n*\\t*\\.\\s*\\n*\\t*${statics.METHODS[idxMethod]}\\s*\\n*\\t*\\()|`;
      }
      regexChainedEndpoint = regexChainedEndpoint.replace(/\|$/, '');
      auxData = auxData.split(new RegExp(regexChainedEndpoint));
      auxData = auxData.filter(d => d);
      for (let idx = 1; idx < auxData.length; idx += 2) {
        if (auxData[idx + 1] && auxData[idx + 1].split('/*')[0].includes('*/'))
          // Avoind modification in string of #swagger.description
          continue;
        auxData[idx] = auxData[idx].replace('.', '____CHAINED____.');
      }
      auxData = auxData.join('');
      // END CASE

      const methods = [...statics.METHODS, 'use', 'all'];
      for (let idx = 0; idx < methods.length; ++idx) {
        for (let idxPtn = 0; idxPtn < patterns.length; ++idxPtn) {
          const method = methods[idx];
          const pattern = patterns[idxPtn];
          const regexMethods = `${pattern}\\s*\\n*\\t*\\.\\s*\\n*\\t*${method}\\s*\\n*\\t*\\(`;
          auxData = auxData.split(new RegExp(regexMethods));

          /**
           * Chained middlewares. For example: route.use(...).use(...).use(...)
           */
          if (auxData && auxData.length > 1 && method == 'use') {
            for (let idxData = 1; idxData < auxData.length; ++idxData) {
              const chainedUse = auxData[idxData].split(
                new RegExp(`\\)\\s*\\n*\\t*\\.\\s*\\n*\\t*use\\s*\\n*\\t*\\(`),
              );
              if (chainedUse.length > 1) {
                auxData[idxData] = chainedUse.join(
                  `) ${pattern}` + `.use([_[use]_])([_[${pattern}]_])(`,
                );
              }
            }
          }
          auxData = auxData.join(
            `${pattern || '_app'}.${method}([_[${method}]_])([_[${pattern}]_])(`,
          );
        }

        if (idx == methods.length - 1) {
          /* Adding byte position */
          auxData = auxData.split(']_])([_[');
          let bytePosition = auxData[0].split('([_[')[0].length;
          for (let idxPtn = 1; idxPtn < auxData.length; ++idxPtn) {
            const auxBytePosition = auxData[idxPtn].split(']_])(')[1].split('([_[')[0].length;
            auxData[idxPtn] = auxData[idxPtn].replace(']_])(', `]_])([_[${bytePosition}]_])(`);
            bytePosition += auxBytePosition;
          }
          auxData = auxData.join(']_])([_[');

          return resolve(auxData);
        }
      }
    } catch (err) {
      return resolve(origData);
    }
  });
}

/**
 * TODO: fill
 * @param {*} elem
 * @param {*} request
 * @param {*} objParameters
 */
function getQueryIndirectly(elem, request, objParameters) {
  const origObjParameters = objParameters;
  try {
    for (let idx = 0; idx < request.length; ++idx) {
      const req = request[idx];
      if (
        req &&
        req.split(new RegExp('\\;|\\{|\\(|\\[|\\"|\\\'|\\`|\\}|\\)|\\]|\\:|\\,|\\*|\\!|\\|'))
          .length == 1 &&
        elem &&
        elem.split(
          new RegExp(` .*?\\s*\\t*=\\s*\\t*${req}\\.\\s*\\t*query(\\s|\\n|;|\\t)`, 'gmi').length >
            1,
        )
      ) {
        const queryVars = [];
        let aQuerys = elem.split(
          new RegExp(`\\s*\\t*=\\s*\\t*${req}\\.\\s*\\t*query(\\s|\\n|;|\\t)`, 'i'),
        );
        aQuerys = aQuerys.slice(0, -1);

        if (aQuerys.length > 0) {
          // get variables name
          for (let idx = 0; idx < aQuerys.length; idx++) {
            if (aQuerys[idx] && aQuerys[idx].replaceAll(' ', '') != '') {
              queryVars.push(aQuerys[idx].split(new RegExp('\\s*|\\t*')).slice(-1)[0]);
            }
          }
          if (queryVars.length > 0) {
            queryVars.forEach(query => {
              if (
                query &&
                query.split(
                  new RegExp('\\;|\\{|\\(|\\[|\\"|\\\'|\\`|\\}|\\)|\\]|\\:|\\,|\\*|\\!|\\|'),
                ).length == 1
              ) {
                let varNames = elem.split(new RegExp(` ${query}\\.`)).splice(1);
                varNames = varNames.map(v => (v = v.split(new RegExp('\\s|;|\\n|\\t'))[0]));
                varNames.forEach(name => {
                  objParameters[name] = {
                    name,
                    in: 'query',
                  };
                });
              }
            });
          }
        }
      }
    }
    return objParameters;
  } catch (err) {
    return origObjParameters;
  }
}

/**
 * Recognize content of .status(...) method (ExpressJS).
 * @param {string} elem content.
 * @param {array} response array containing variables of response.
 * @param {object} objResponses
 */
function getStatus(elem, response, objResponses) {
  const origObjResponses = objResponses;
  try {
    for (let idx = 0; idx < response.length; ++idx) {
      const res = response[idx];
      if (
        res &&
        elem &&
        elem
          .replaceAll(' ', '')
          .split(
            new RegExp(
              `${res}\\s*\\n*\\t*\\.\\s*\\n*\\t*status\\s*\\(|${res}\\s*\\n*\\t*\\.\\s*\\n*\\t*sendStatus\\s*\\(`,
            ),
          ).length > 1
      ) {
        elem
          .replaceAll(' ', '')
          .split(
            new RegExp(
              `${res}\\s*\\n*\\t*\\.\\s*\\n*\\t*status\\s*\\(|${res}\\s*\\n*\\t*\\.\\s*\\n*\\t*sendStatus\\s*\\(`,
            ),
          )
          .splice(1)
          .forEach(async s => {
            let status = await utils.stackSymbolRecognizer(s, '(', ')');
            status = status.replaceAll('(', '').replaceAll(')', '');

            if (
              status &&
              !utils.isNumeric(status) &&
              status.split(new RegExp('\\?|\\|\\||\\:')).length > 1
            ) {
              /**
               * CASE: Handle status function (Express.js) with variables or multiple status code
               * Issue: #62
               */
              const auxStatus = status.split(new RegExp('\\?|\\|\\||\\:'));
              auxStatus.forEach(sts => {
                if (utils.isNumeric(sts) && !!objResponses[sts] === false) {
                  objResponses[sts] = {
                    description:
                      tables.getHttpStatusDescription(sts, swaggerTags.getLanguage()) || '',
                  };
                } else if (utils.isNumeric(sts) && !!objResponses[sts] === true) {
                  // concatenated with existing information
                  objResponses[sts] = {
                    description:
                      tables.getHttpStatusDescription(sts, swaggerTags.getLanguage()) || '',
                    ...objResponses[sts],
                  };
                }
              });
            } else if (utils.isNumeric(status) && !!objResponses[status] === false) {
              objResponses[status] = {
                description:
                  tables.getHttpStatusDescription(status, swaggerTags.getLanguage()) || '',
              };
            } else if (utils.isNumeric(status) && !!objResponses[status] === true) {
              // concatenated with existing information
              objResponses[status] = {
                description:
                  tables.getHttpStatusDescription(status, swaggerTags.getLanguage()) || '',
                ...objResponses[status],
              };
            }
          });
      }

      /**
       * Catching status code 200 when res.send(...) or res.json(...)
       */
      if (
        res &&
        elem &&
        elem
          .replaceAll(' ', '')
          .split(
            new RegExp(
              `${res}\\s*\\n*\\t*\\.\\s*\\n*\\t*send\\s*\\(|${res}\\s*\\n*\\t*\\.\\s*\\n*\\t*json\\s*\\(|${res}\\s*\\n*\\t*\\.\\s*\\n*\\t*sendFile\\s*\\(`,
            ),
          ).length > 1
      ) {
        if (!!objResponses[200] === false) {
          objResponses[200] = {
            description: tables.getHttpStatusDescription(200, swaggerTags.getLanguage()),
          };
        } else if (!!objResponses[200] === true) {
          // concatenated with existing information
          objResponses[200] = {
            description: tables.getHttpStatusDescription(200, swaggerTags.getLanguage()),
            ...objResponses[200],
          };
        }
      }
    }
    return objResponses;
  } catch (err) {
    return origObjResponses;
  }
}

/**
 * Recognize content of .setHeader(...) method (ExpressJS).
 * @param {string} elem content.
 * @param {string} path endpoint's path.
 * @param {string} method
 * @param {array} response array containing variables of response.
 * @param {object} objEndpoint
 */
function getHeader(elem, path, method, response, objEndpoint) {
  const origObjEndpoint = objEndpoint;
  try {
    for (let idx = 0; idx < response.length; ++idx) {
      const res = response[idx];
      if (res && elem && elem.replaceAll(' ', '').includes(`${res}.setHeader(`)) {
        elem = elem.replaceAll(' ', '');
        const aContentType = new Set(); // To avoid repetition
        elem
          .split(`${res}.setHeader(`)
          .splice(1)
          .forEach(s => {
            if (
              s &&
              s.includes(',') &&
              s.split(',')[0].includes('content-type') &&
              s.split(',"')[1]
            )
              aContentType.add(s.split(',"')[1].split('")')[0]);
          });
        objEndpoint[path][method].produces = [...aContentType];
      }
    }
    return objEndpoint;
  } catch (err) {
    return origObjEndpoint;
  }
}

/**
 * Recognize query and body content.
 * @param {string} elem content.
 * @param {array} request array containing variables of response.
 * @param {object} objParameters
 */
function getHeaderQueryBody(elem, request, objParameters) {
  const origObjParameters = objParameters;

  if (elem) {
    elem = elem
      .split(new RegExp('\\s*\\n*\\t*\\.\\s*\\n*\\t*query\\s*\\n*\\t*\\.\\s*\\n*\\t*'))
      .join('.query.');
    elem = elem
      .split(new RegExp('\\s*\\n*\\t*\\.\\s*\\n*\\t*body\\s*\\n*\\t*\\.\\s*\\n*\\t*'))
      .join('.body.');
    elem = elem
      .split(new RegExp('\\s*\\n*\\t*\\.\\s*\\n*\\t*headers\\s*\\n*\\t*\\.\\s*\\n*\\t*'))
      .join('.headers.');
    elem = elem
      .split(new RegExp('\\s*\\n*\\t*\\.\\s*\\n*\\t*query\\s*\\n*\\t*[\\;|\\,|\\}|\\]|\\)]'))
      .join('.query ');
    elem = elem
      .split(new RegExp('\\s*\\n*\\t*\\.\\s*\\n*\\t*body\\s*\\n*\\t*[\\;|\\,|\\}|\\]|\\)]'))
      .join('.body ');
    elem = elem
      .split(new RegExp('\\s*\\n*\\t*\\.\\s*\\n*\\t*headers\\s*\\n*\\t*[\\;|\\,|\\}|\\]|\\)]'))
      .join('.headers ');
  }

  try {
    for (let idx = 0; idx < request.length; ++idx) {
      const req = request[idx];

      if (
        req &&
        req.split(/\(|\)|\{|\}|\[|\]|\/|\\|;|:|!|@|\$|#|=|\?|\+|,|\||&|\t|\n|"|'|`|\*/).length > 1
      ) {
        continue;
      }

      /**
       * Headers
       */
      if (req && elem && elem.split(`${req}.headers.`).length > 1) {
        elem
          .split(`${req}.headers.`)
          .splice(1)
          .forEach(p => {
            p = p.trim();
            let name = p
              .split(/\(|\)|\{|\}|\[|\]|\/|\\|;|:|!|@|\$|#|=|\?|\+|,|\||&|\t|\n| /)[0]
              .replaceAll(' ', '')
              .replaceAll('\r', '');
            if (name.includes('.')) {
              name = name.split('.')[0];
            }

            name = name.replaceAll('...', '');

            if (
              !!objParameters[name] === false ||
              (objParameters[name] && objParameters[name].name !== name) ||
              (objParameters[name] &&
                objParameters[name].name === name &&
                objParameters[name].in !== 'header')
            ) {
              name += `__[__[__header__]__]`;

              if (!!objParameters[name] === false) {
                // Checks if the parameter name already exists
                objParameters[name] = {
                  name,
                  in: 'header',
                };
              }
              if (!objParameters[name].in) {
                objParameters[name].in = 'header';
              }
              if (!objParameters[name].type && !objParameters[name].schema) {
                // by default: 'type' is 'string' when 'schema' is missing
                if (swaggerTags.getOpenAPI()) {
                  objParameters[name].schema = { type: 'string' };
                } else {
                  objParameters[name].type = 'string';
                }
              }
            }
          });
      }

      /**
       * Headers
       * Destructuring in body, such as: {a, b} = req.headers
       */
      if (
        req &&
        elem &&
        elem.split(new RegExp(`\\}\\s*\\n*\\t*\\=\\s*\\n*\\t*${req}.headers\\s+`)).length > 1
      ) {
        const elems = elem.split(new RegExp(`\\}\\s*\\n*\\t*\\=\\s*\\n*\\t*${req}.headers\\s+`));
        for (let idxHeader = 0; idxHeader < elems.length - 1; ++idxHeader) {
          let header = elems[idxHeader]; // objBody

          if (header.split(new RegExp('\\:\\s*\\n*\\t*\\{')).length > 1) {
            const subObjs = header.split(new RegExp('\\:\\s*\\n*\\t*\\{'));
            for (let idxObj = 1; idxObj < subObjs.length; ++idxObj) {
              subObjs[idxObj] = subObjs[idxObj].split('}')[1];
            }
            header = subObjs.join('');
          }

          header = header.split('{').slice(-1)[0];
          header = header.split(',');
          header.map(name => {
            name = name.trim();
            name = name.replaceAll('...', '');
            name = name
              .split(/\(|\)|\{|\}|\[|\]|\/|\\|;|:|!|@|\$|#|=|\?|\+|,|\||&|\t|\n| /)[0]
              .replaceAll(' ', '')
              .replaceAll('\r', '');
            if (name == '') {
              return;
            }

            if (
              !!objParameters[name] === false ||
              (objParameters[name] && objParameters[name].name !== name) ||
              (objParameters[name] &&
                objParameters[name].name === name &&
                objParameters[name].in !== 'header')
            ) {
              name += `__[__[__header__]__]`;

              if (!!objParameters[name] === false) {
                // Checks if the parameter name already exists
                objParameters[name] = {
                  name,
                  in: 'header',
                };
              }
              if (!objParameters[name].in) {
                objParameters[name].in = 'header';
              }
              if (!objParameters[name].type && !objParameters[name].schema) {
                // by default: 'type' is 'string' when 'schema' is missing
                if (swaggerTags.getOpenAPI()) {
                  objParameters[name].schema = { type: 'string' };
                } else {
                  objParameters[name].type = 'string';
                }
              }
            }
          });
        }
      }

      /**
       * Headers
       * E.g: let someHeader = req.headers['x-token']
       */
      if (req && elem && elem.split(`${req}.headers[`).length > 1) {
        const elems = elem.split(`${req}.headers[`);
        for (let idxHeader = 1; idxHeader < elems.length; ++idxHeader) {
          const header = elems[idxHeader];
          if (header.split(statics.STRING_QUOTE).length > 2) {
            let name = header.split(statics.STRING_QUOTE)[1];
            name = name.trim();
            name = name.replaceAll('...', '');
            name = name
              .split(/\(|\)|\{|\}|\[|\]|\/|\\|;|:|!|@|\$|#|=|\?|\+|,|\||&|\t|\n| /)[0]
              .replaceAll(' ', '')
              .replaceAll('\r', '');
            if (name == '') {
              break;
            }

            if (
              !!objParameters[name] === false ||
              (objParameters[name] && objParameters[name].name !== name) ||
              (objParameters[name] &&
                objParameters[name].name === name &&
                objParameters[name].in !== 'header')
            ) {
              name += `__[__[__header__]__]`;

              if (!!objParameters[name] === false) {
                // Checks if the parameter name already exists
                objParameters[name] = {
                  name,
                  in: 'header',
                };
              }
              if (!objParameters[name].in) {
                objParameters[name].in = 'header';
              }
              if (!objParameters[name].type && !objParameters[name].schema) {
                // by default: 'type' is 'string' when 'schema' is missing
                if (swaggerTags.getOpenAPI()) {
                  objParameters[name].schema = { type: 'string' };
                } else {
                  objParameters[name].type = 'string';
                }
              }
            }
          }
        }
      }

      /**
       * query
       */
      if (req && elem && elem.split(`${req}.query.`).length > 1) {
        elem
          .split(`${req}.query.`)
          .splice(1)
          .forEach(p => {
            p = p.trim();
            let name = p
              .split(/\(|\)|\{|\}|\[|\]|\/|\\|;|:|!|@|\$|#|=|\?|\+|,|\||&|\t|\n| /)[0]
              .replaceAll(' ', '')
              .replaceAll('\r', '');
            if (name.includes('.')) {
              name = name.split('.')[0];
            }

            name = name.replaceAll('...', '');

            if (
              !!objParameters[name] === false ||
              (objParameters[name] && objParameters[name].name !== name) ||
              (objParameters[name] &&
                objParameters[name].name === name &&
                objParameters[name].in !== 'query')
            ) {
              name += `__[__[__query__]__]`;

              if (!!objParameters[name] === false) {
                // Checks if the parameter name already exists
                objParameters[name] = {
                  name,
                  in: 'query',
                };
              }
              if (!objParameters[name].in) {
                objParameters[name].in = 'query';
              }
              if (!objParameters[name].type && !objParameters[name].schema) {
                // by default: 'type' is 'string' when 'schema' is missing
                if (swaggerTags.getOpenAPI()) {
                  objParameters[name].schema = { type: 'string' };
                } else {
                  objParameters[name].type = 'string';
                }
              }
            }
          });
      }

      /**
       * Pull Request (#30)
       * CASE: Destructuring in body, such as: {a, b} = req.query
       * Created by: WHL
       * Modified by: Davi Baltar
       */
      if (
        req &&
        elem &&
        elem.split(new RegExp(`\\}\\s*\\n*\\t*\\=\\s*\\n*\\t*${req}.query\\s+`)).length > 1
      ) {
        const elems = elem.split(new RegExp(`\\}\\s*\\n*\\t*\\=\\s*\\n*\\t*${req}.query\\s+`));
        for (let idxQuery = 0; idxQuery < elems.length - 1; ++idxQuery) {
          let query = elems[idxQuery]; // objBody

          /**
           * CASE: const { item1, item2: { subItem1, subItem2 } } = req.query;
           * Solution: Eliminate sub-items for now
           * TODO: In the furute, handle sub-items
           */
          if (query.split(new RegExp('\\:\\s*\\n*\\t*\\{')).length > 1) {
            const subObjs = query.split(new RegExp('\\:\\s*\\n*\\t*\\{'));
            for (let idxObj = 1; idxObj < subObjs.length; ++idxObj) {
              subObjs[idxObj] = subObjs[idxObj].split('}')[1];
            }
            query = subObjs.join('');
          }
          /* END CASE */

          query = query.split('{').slice(-1)[0];
          query = query.split(',');
          query.map(name => {
            name = name.trim();
            name = name.replaceAll('...', '');
            name = name
              .split(/\(|\)|\{|\}|\[|\]|\/|\\|;|:|!|@|\$|#|=|\?|\+|,|\||&|\t|\n| /)[0]
              .replaceAll(' ', '')
              .replaceAll('\r', '');
            if (name == '') {
              return;
            }

            if (
              !!objParameters[name] === false ||
              (objParameters[name] && objParameters[name].name !== name) ||
              (objParameters[name] &&
                objParameters[name].name === name &&
                objParameters[name].in !== 'query')
            ) {
              name += `__[__[__query__]__]`;

              if (!!objParameters[name] === false) {
                // Checks if the parameter name already exists
                objParameters[name] = {
                  name,
                  in: 'query',
                };
              }
              if (!objParameters[name].in) {
                objParameters[name].in = 'query';
              }
              if (!objParameters[name].type && !objParameters[name].schema) {
                // by default: 'type' is 'string' when 'schema' is missing
                if (swaggerTags.getOpenAPI()) {
                  objParameters[name].schema = { type: 'string' };
                } else {
                  objParameters[name].type = 'string';
                }
              }
            }
          });
        }
      }

      /**
       * Pull Request (#30)
       * CASE: Recognize body parameters
       * Created by: WHL
       * Modified by: Davi Baltar
       */
      if (req && elem && elem.split(`${req}.body.`).length > 1) {
        elem
          .split(`${req}.body.`)
          .splice(1)
          .forEach(p => {
            p = p.trim();
            let name = p
              .split(/\(|\)|\{|\}|\[|\]|\/|\\|;|:|!|@|\$|#|=|\?|\+|,|\||&|\t|\n| /)[0]
              .replaceAll(' ', '')
              .replaceAll('\r', '');
            if (name.includes('.')) {
              name = name.split('.')[0];
            }

            name = name.replaceAll('...', '');

            if (!!objParameters.__obj__in__body__ === false) {
              objParameters.__obj__in__body__ = {
                name: '__obj__in__body__',
                in: 'body',
                schema: {
                  type: 'object',
                  properties: {},
                },
              };
            }
            if (!!objParameters.__obj__in__body__ === true) {
              // Checks if the parameter name already exists
              objParameters.__obj__in__body__.schema.properties[name] = {
                example: 'any',
              };
            }
          });
      }

      /**
       * Pull Request (#30)
       * CASE: Destructuring in body, such as: {a, b} = req.body
       * Created by: WHL
       * Modified by: Davi Baltar
       */
      if (
        req &&
        elem &&
        elem.split(new RegExp(`\\}\\s*\\n*\\t*\\=\\s*\\n*\\t*${req}.body\\s+`)).length > 1
      ) {
        const elems = elem.split(new RegExp(`\\}\\s*\\n*\\t*\\=\\s*\\n*\\t*${req}.body\\s+`));
        for (let idxBody = 0; idxBody < elems.length - 1; ++idxBody) {
          let objBody = elems[idxBody];

          /**
           * CASE: const { item1, item2: { subItem1, subItem2 } } = req.body;
           * Solution: Eliminate sub-items for now
           * TODO: In the future, handle sub-items
           */
          if (objBody.split(new RegExp('\\:\\s*\\n*\\t*\\{')).length > 1) {
            const subObjs = objBody.split(new RegExp('\\:\\s*\\n*\\t*\\{'));
            for (let idxObj = 1; idxObj < subObjs.length; ++idxObj) {
              subObjs[idxObj] = subObjs[idxObj].split('}')[1];
            }
            objBody = subObjs.join('');
          }
          /* END CASE */

          objBody = objBody.split('{').slice(-1)[0];
          objBody = objBody.split(',');
          objBody.map(name => {
            name = name.trim();
            name = name.replaceAll('...', '');
            name = name
              .split(/\(|\)|\{|\}|\[|\]|\/|\\|;|:|!|@|\$|#|=|\?|\+|,|\||&|\t|\n| /)[0]
              .replaceAll(' ', '')
              .replaceAll('\r', '');
            if (name == '') {
              return;
            }

            if (!!objParameters.__obj__in__body__ === false) {
              objParameters.__obj__in__body__ = {
                name: '__obj__in__body__',
                in: 'body',
                schema: {
                  type: 'object',
                  properties: {},
                },
              };
            }
            if (!!objParameters.__obj__in__body__ === true) {
              // Checks if the parameter name already exists
              objParameters.__obj__in__body__.schema.properties[name] = {
                example: 'any',
              };
            }
          });
        }
      }
    }
    return objParameters;
  } catch (err) {
    return origObjParameters;
  }
}

/**
 * Recognize callback parameters.
 * @param {string} data content.
 */
async function getCallbackParameters(data) {
  if (!data) {
    return {
      req: [],
      res: [],
      next: [],
    };
  }
  const req = new Set();
  const res = new Set();
  const next = new Set();

  const regex = '\\=|\\{|\\}|\\(|\\)|\\[|\\]|\\!|\\,';

  try {
    const splitedParams = data.split(new RegExp('(\\(|\\))'));
    for (let idx = 0; idx < splitedParams.length; ++idx) {
      let pos = splitedParams[idx + 2] || '';

      if (!pos) {
        continue;
      }

      if (pos !== '') {
        pos = await removeComments(pos);
        pos = await removeStrings(pos);
      }

      const arrowFunctionPos = pos.split(new RegExp(`(\\s*\\t*=>\\s*\\n*\\t*\\{)`));
      let arrowFunctionWithoutCurlyBracketPos = [''];
      let traditionalFunctionPos = [''];

      if (arrowFunctionPos.length == 1) {
        arrowFunctionWithoutCurlyBracketPos = pos.split(new RegExp(`(\\s*\\t*=>)`));
        if (arrowFunctionWithoutCurlyBracketPos.length == 1)
          traditionalFunctionPos = pos.split(
            new RegExp(
              `(\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\w*\\s*\\n*\\t*\\<?\\s*\\n*\\t*\\w*\\s*\\n*\\t*\\>?\\s*\\n*\\t*\\{)`,
            ),
          );
      }

      let isFunction = false;
      if (
        arrowFunctionPos.length > 1 ||
        arrowFunctionWithoutCurlyBracketPos.length > 1 ||
        traditionalFunctionPos.length > 1
      ) {
        isFunction = true;
      }

      if (
        isFunction &&
        splitedParams[idx - 2] &&
        splitedParams[idx - 2].split(new RegExp('\\s+if')).length === 1 &&
        splitedParams[idx - 1] &&
        splitedParams[idx - 1].trim() === '(' &&
        splitedParams[idx + 1] &&
        splitedParams[idx + 1].trim() === ')'
      ) {
        let params = splitedParams[idx];
        params = params.split(',');
        // Request
        if (params[0] && params[0].includes(':')) {
          // TS
          const typeParam = params[0].split(':')[1].toLocaleLowerCase();
          const param = params[0]
            .split(':')[0]
            .replaceAll('\n', '')
            .replaceAll('\t', '')
            .replaceAll(' ', '');
          if (typeParam.includes('res')) {
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              res.add(param);
            }
          } else if (typeParam.includes('req')) {
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              req.add(param);
            }
          } else if (typeParam.includes('next')) {
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              next.add(param);
            }
          } else {
            // any
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              req.add(param);
            }
          }
        } else if (params[0]) {
          // JS
          const param = params[0].replaceAll('\n', '').replaceAll('\t', '').replaceAll(' ', '');
          if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
            req.add(param);
          }
        }

        // Response
        if (params[1] && params[1].includes(':')) {
          // TS
          const typeParam = params[1].split(':')[1].toLocaleLowerCase();
          const param = params[1]
            .split(':')[0]
            .replaceAll('\n', '')
            .replaceAll('\t', '')
            .replaceAll(' ', '');
          if (typeParam.includes('res')) {
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              res.add(param);
            }
          } else if (typeParam.includes('req')) {
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              req.add(param);
            }
          } else if (typeParam.includes('next')) {
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              next.add(param);
            }
          } else {
            // any
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              res.add(param);
            }
          }
        } else if (params[1]) {
          // JS
          const param = params[1].replaceAll('\n', '').replaceAll('\t', '').replaceAll(' ', '');
          if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
            res.add(param);
          }
        }

        // Next middleware
        if (params[2] && params[2].includes(':')) {
          // TS
          const typeParam = params[2].split(':')[1].toLocaleLowerCase();
          const param = params[2]
            .split(':')[0]
            .replaceAll('\n', '')
            .replaceAll('\t', '')
            .replaceAll(' ', '');
          if (typeParam.includes('res')) {
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              res.add(param);
            }
          } else if (typeParam.includes('req')) {
            if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
              req.add(param);
            }
          } else if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
            next.add(param);
          }
        } else if (params[2]) {
          // JS
          const param = params[2].replaceAll('\n', '').replaceAll('\t', '').replaceAll(' ', '');
          if (param.split(new RegExp(regex)).length === 1 && param && param.trim() !== '') {
            next.add(param);
          }
        }
      }
    }
    return {
      req: [...req],
      res: [...res],
      next: [...next],
    };
  } catch (err) {
    return {
      req: [...req],
      res: [...res],
      next: [...next],
    };
  }
}

/**
 * Recognize path parameters.
 * @param {string} path
 * @param {object} objParameters
 */
async function getPathParameters(path, objParameters) {
  if (!path) {
    return objParameters;
  }
  const origObjParameters = objParameters;
  try {
    if (path.split('{').length > 1) {
      let name = ' ';
      let cnt = 0;
      while (path.includes('{')) {
        name = await utils.stack0SymbolRecognizer(path, '{', '}');
        path = path.split(`{${name}}`);
        path = path.join('');

        if (!!objParameters[name] === false)
          if (swaggerTags.getOpenAPI()) {
            // Checks if the parameter name already exists
            objParameters[name] = {
              name,
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            };
          } else {
            objParameters[name] = {
              name,
              in: 'path',
              required: true,
              type: 'string',
            }; // by deafult 'type' is 'string'
          }

        cnt += 1;
        if (cnt > 10) {
          // Avoiding infinite loop
          return objParameters;
        }
      }
      return objParameters;
    }
    return objParameters;
  } catch (err) {
    return origObjParameters;
  }
}

/**
 * Recognize function in a string data.
 * @param {string} data content.
 * @param {string} functionName
 */
async function functionRecognizerInData(data, functionName) {
  if (!data || !functionName) {
    return null;
  }

  try {
    let func = null;
    functionName = functionName.split(
      new RegExp('\\;|\\{|\\(|\\[|\\"|\\\'|\\`|\\}|\\)|\\]|\\:|\\,|\\*|\\+'),
    );
    if (functionName.length > 1) {
      functionName = functionName.filter(r => r != '');
      if (utils.isNumeric(functionName[1])) {
        /* issue: (#45) */ functionName = functionName[0];
      } else {
        functionName = functionName[1];
      }
    } else {
      functionName = functionName[0];
    }

    if (functionName == '') {
      return null;
    }

    if (
      data.split(new RegExp(`\\w+${functionName}|${functionName}\\w+|\\w+${functionName}\\w+`))
        .length > 1
    ) {
      data = data.replaceAll(`.headers.${functionName}`, '____HEADERS____');
      data = data.replaceAll(
        new RegExp(`var\\s+\\n*\\t*\\{\\s*\\n*\\t*${functionName}`),
        '____VARIABLE_DEST____',
      );
      data = data.replaceAll(
        new RegExp(`let\\s+\\n*\\t*\\{\\s*\\n*\\t*${functionName}`),
        '____VARIABLE_DEST____',
      );
      data = data.replaceAll(
        new RegExp(`const\\s+\\n*\\t*\\{\\s*\\n*\\t*${functionName}`),
        '____VARIABLE_DEST____',
      );
      data = data.replaceAll(new RegExp(`\\,\\s*\\n*\\t*${functionName}`), '____VARIABLE____');
      data = data.replaceAll(
        new RegExp(`body\\s*\\n*\\t*\\.\\s*\\n*\\t*${functionName}`),
        '____VARIABLE_BODY____',
      );
      data = data.replaceAll(
        new RegExp(`query\\s*\\n*\\t*\\.\\s*\\n*\\t*${functionName}`),
        '____VARIABLE_QUERY____',
      );
      data = data.replaceAll(
        new RegExp(`headers\\s*\\n*\\t*\\.\\s*\\n*\\t*${functionName}`),
        '____VARIABLE_HEADERS____',
      );

      data = data.split(new RegExp(`${functionName}`));
      if (data.length > 1) {
        for (let idxHeader = 1; idxHeader < data.length; ++idxHeader) {
          const startComment = utils.getFirstPosition('/*', data[idxHeader].split('//')[0]);
          const endComment = utils.getFirstPosition('*/', data[idxHeader].split('//')[0]);
          if ((endComment && !startComment) || startComment > endComment) {
            // keep in comment
            data[idxHeader] = `____KEEP_NAME____${data[idxHeader]}`;
          } else {
            data[idxHeader] = `${functionName}${data[idxHeader]}`;
          }
        }
        data = data.join('');
      } else {
        data = data[0];
      }
      data = data.split(
        new RegExp(`\\w+${functionName}|${functionName}\\w+|\\w+${functionName}\\w+`),
      );
      data = data.join('____FUNC____');

      data = data.replaceAll('____KEEP_NAME____', `${functionName}`);
      data = data.replaceAll('____HEADERS____', `.headers.${functionName}`);
      data = data.replaceAll('____VARIABLE_DEST____', `let { ${functionName}`);
      data = data.replaceAll('____VARIABLE____', `, ${functionName}`);
      data = data.replaceAll('____VARIABLE_BODY____', `body.${functionName}`);
      data = data.replaceAll('____VARIABLE_QUERY____', `query.${functionName}`);
      data = data.replaceAll('____VARIABLE_HEADERS____', `headers.${functionName}`);
    }

    data = data.replaceAll(' function ', ' ');

    let arrowFunction = data.split(
      new RegExp(
        `(${functionName}\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\w*\\s*\\n*\\t*\\=\\s*\\n*\\t*\\([\\s\\S]*\\)\\s*\\t*=>\\s*\\n*\\t*\\{)`,
      ),
    );
    let arrowFunctionWithoutCurlyBracket = [''];
    let traditionalFunction = [''];
    let arrowFunctionType = 1;

    if (arrowFunction.length == 1) {
      arrowFunctionWithoutCurlyBracket = data.split(
        new RegExp(
          `(${functionName}\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\w*\\s*\\n*\\t*\\=\\s*\\n*\\t*\\([\\s\\S]*\\)\\s*\\t*=>)`,
        ),
      );
      if (arrowFunctionWithoutCurlyBracket.length == 1) {
        // CASE:  foo: (req, res) => {
        arrowFunction = data.split(
          new RegExp(
            `(${functionName}\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\s*\\n*\\t*\\s*\\n*\\t*\\([\\s\\S]*\\)\\s*\\t*=>\\s*\\n*\\t*\\{)`,
          ),
        );
        if (arrowFunction.length > 1) {
          arrowFunctionType = 2;
        } else {
          // Default: Traditional function
          traditionalFunction = data.split(
            new RegExp(
              `(${functionName}\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\=?\\s*\\n*\\t*\\([\\s\\S]*\\)\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\w*\\s*\\n*\\t*\\<?\\s*\\n*\\t*\\w*\\s*\\n*\\t*\\>?\\s*\\n*\\t*\\{)`,
            ),
          );
          if (
            traditionalFunction.length == 1 &&
            data.split(new RegExp(`${functionName}\\s*\\n*\\t*=\\s*\\n*\\t*\\[`)).length == 1
          ) {
            // CASE: exports.validateUser = [ ]
            return null;
          }
        }
      }
    }

    let isArrowFunction = false;
    let isArrowFunctionWithoutCurlyBracket = false;
    let isTraditionalFunction = false;

    if (arrowFunction.length > 1) {
      func = arrowFunction;
      isArrowFunction = true;
    } else if (arrowFunctionWithoutCurlyBracket.length > 1) {
      func = arrowFunctionWithoutCurlyBracket;
      isArrowFunctionWithoutCurlyBracket = true;
    } else if (traditionalFunction.length > 1) {
      func = traditionalFunction;
      isTraditionalFunction = true;
    } else {
      // CASE: exports.validateUser = [ ]
      const array = data.split(new RegExp(`${functionName}\\s*\\n*\\t*=\\s*\\n*\\t*\\[`));
      if (array.length > 1) {
        const resp = await utils.stackSymbolRecognizer(array[1], '(', ')');
        return `[${resp}`;
      }
    }

    if (func && func.length > 1) {
      func.shift();
      func = func.join(' ');
    }

    if (func && func.length > 1) {
      if (isArrowFunctionWithoutCurlyBracket) {
        // CASE: arrow funciton without {, for example: func => func(...);
        let funcStr = func;
        funcStr = funcStr.split('=>')[0];
        if (funcStr.includes('=')) {
          funcStr = funcStr.split('=')[1];
        }
        funcStr += '=> {';
        let arrowFunc = func.split('=>')[1].trimLeft();
        arrowFunc = arrowFunc.split(new RegExp('\\n|\\s|\\t|\\;'));
        for (let idx = 0; idx < arrowFunc.length; idx++) {
          if (arrowFunc[idx] != '') {
            const strRet = `${funcStr + arrowFunc[idx]}}`;
            return strRet;
          }
          if (idx == arrowFunc.length - 1) {
            return null;
          }
        }
      } else if (isArrowFunction || isTraditionalFunction) {
        func = func.split('{');
        func.shift();
        func = func.join('{');
        let funcStr = null;
        if (isArrowFunction && arrowFunctionType == 1) {
          funcStr = data.split(
            new RegExp(
              `${functionName}\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\w*\\s*\\n*\\t*\\=\\s*\\n*\\t*\\(`,
            ),
          )[1];
        }
        if (isArrowFunction && arrowFunctionType == 2) {
          funcStr = data.split(
            new RegExp(`${functionName}\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\s*\\n*\\t*\\s*\\n*\\t*\\(`),
          )[1];
        } else if (isTraditionalFunction) {
          funcStr = data.split(
            new RegExp(`${functionName}\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\=?\\s*\\n*\\t*\\(`),
          )[1];
        }

        if (funcStr && funcStr.split('}').length > 1) {
          funcStr = funcStr.split('{')[0];
        }
        funcStr = `(${funcStr}${isArrowFunction ? ' { ' : ' => { '}`; // TODO: Verify case 'funcStr' with '=> =>'
        let cleanedParams = funcStr.split(')')[0];
        cleanedParams = cleanedParams
          .split(',')
          .map(p => {
            return p.split('=')[0];
          })
          .join(',');
        funcStr = `${cleanedParams})${funcStr.split(')')[1]}`;
        const finalFunc = await utils.stackSymbolRecognizer(func, '{', '}');
        return funcStr + finalFunc;
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch (err) {
    return null;
  }
}

/**
 * Return the first function in a string.
 * @param {string} data content.
 */
async function popFunction(data) {
  if (!data) {
    return null;
  }

  try {
    const arrowFunction = data.split(
      new RegExp(`(\\s*\\n*\\t*\\([\\s\\S]*\\)\\s*\\t*=>\\s*\\n*\\t*\\{)`),
    ); // arrow function with '{' and '}'
    let arrowFunctionWithoutCurlyBracket = [''];
    let traditionalFunction = [''];

    if (arrowFunction.length == 1) {
      arrowFunctionWithoutCurlyBracket = data.split(
        new RegExp(`(\\s*\\n*\\t*\\([\\s\\S]*\\)\\s*\\t*=>)`),
      ); // arrow function without '{' and '}'
      if (arrowFunctionWithoutCurlyBracket.length == 1) {
        traditionalFunction = data.split(
          new RegExp(
            `(\\s*\\n*\\t*\\([\\s\\S]*\\)\\s*\\n*\\t*\\:?\\s*\\n*\\t*\\w*\\s*\\n*\\t*\\<?\\s*\\n*\\t*\\w*\\s*\\n*\\t*\\>?\\s*\\n*\\t*\\{)`,
          ),
        ); // traditional function with '{' and '}'
      }
    }

    let isArrowFunction = false;
    let isArrowFunctionWithoutCurlyBracket = false;
    let isTraditionalFunction = false;

    if (arrowFunction.length > 1) {
      isArrowFunction = true;
    } else if (arrowFunctionWithoutCurlyBracket.length > 1) {
      isArrowFunctionWithoutCurlyBracket = true;
    } else if (traditionalFunction.length > 1) {
      isTraditionalFunction = true;
    }

    if (isArrowFunction || isTraditionalFunction) {
      let signatureFunc = '';
      let func = data.split('{');
      let params = func[0];
      params = params.split('').reverse().join('');
      params = await utils.stack0SymbolRecognizer(params, ')', '(');

      if (params) {
        params = `(${params.split('').reverse().join('')})`;
        signatureFunc = `${params + func[0].split(params)[1]}{`;
      } else {
        // TODO: verify case without '(' and ')'
        signatureFunc = '{';
      }

      func.shift();
      func = func.join('{');
      func = signatureFunc + (await utils.stackSymbolRecognizer(func, '{', '}'));
      return func.trim();
    }
    if (isArrowFunctionWithoutCurlyBracket) {
      let func = data.split('=>')[1].trimLeft();
      const params = await utils.stack0SymbolRecognizer(data, '(', ')');
      const paramsSubFunc = await utils.stack0SymbolRecognizer(func, '(', ')');
      func = func.split(paramsSubFunc)[0];
      func = `(${params}) => { ${func}${paramsSubFunc}) }`;
      return func;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Get the first string in a string.
 * @param {string} data content.
 */
function popString(data) {
  if (!data) {
    return null;
  }

  try {
    data = data.replaceAll('\\"', `${statics.STRING_BREAKER}_quote1_${statics.STRING_BREAKER}`);
    data = data.replaceAll("\\'", `${statics.STRING_BREAKER}_quote2_${statics.STRING_BREAKER}`);
    data = data.replaceAll('\\`', `${statics.STRING_BREAKER}_quote3_${statics.STRING_BREAKER}`);
    data = data.replaceAll("'", '"');
    data = data.replaceAll('`', '"');
    data = data.split('"');

    if (data.length > 1) {
      let str = data[1];
      str = str.replaceAll(`${statics.STRING_BREAKER}_quote1_${statics.STRING_BREAKER}`, '\\"');
      str = str.replaceAll(`${statics.STRING_BREAKER}_quote2_${statics.STRING_BREAKER}`, "\\'");
      str = str.replaceAll(`${statics.STRING_BREAKER}_quote3_${statics.STRING_BREAKER}`, '\\`');
      return str;
    }
    return null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  clearData,
  removeComments,
  removeStrings,
  addReferenceToMethods,
  getQueryIndirectly,
  getStatus,
  getHeader,
  getHeaderQueryBody,
  getCallbackParameters,
  getPathParameters,
  functionRecognizerInData,
  popFunction,
  getSwaggerComments,
  popString,
  removeInsideParentheses,
  dataConverter,
};
