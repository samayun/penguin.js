const { Parser } = require('acorn');
const handleData = require('./handle-data');
const utils = require('./utils');

/**
 * Getting the string until a character to be found.
 * @param {string} data content
 * @param {string} character character that will stop the search
 * @param {boolean} ignoreInString If 'true', the 'character' won't be searched in the string.
 * @returns
 */
function getUntil(data, character, ignoreInString = true) {
  if (!data) {
    return '';
  }
  let stringType = null;
  let resp = '';
  let c = null;
  try {
    for (let idx = 0; idx < data.length; ++idx) {
      c = data[idx];
      if (ignoreInString) {
        if (c == stringType && data[idx - 1] != '\\') {
          stringType = null;
          resp += c;
          continue;
        }
        if (c == "'" && !stringType) {
          stringType = "'";
        } else if (c == '"' && !stringType) {
          stringType = '"';
        } else if (c == '`' && !stringType) {
          stringType = '`';
        }
      }
      if (c == character && !stringType) {
        return resp;
      }
      resp += c;
    }
    return resp;
  } catch (err) {
    return resp;
  }
}

/**
 * Return all nodes that are 'VariableDeclaration'.
 * @param {*} node
 * @returns
 */
function getVariablesNode(node) {
  if (node.body) {
    let v = [];
    if (Array.isArray(node.body)) {
      for (let idx = 0; idx < node.body.length; ++idx) {
        const e = node.body[idx];
        const n = getVariablesNode(e);
        if (Array.isArray(n)) {
          v = [...v, ...n];
        }
        v.push(n);
      }
    } else {
      node.body.body.forEach(e => v.push(getVariablesNode(e)));
    }
    return v.filter(e => e);
  }
  if (node.type === 'VariableDeclaration') {
    if (node.declarations[0].init.type != 'CallExpression') {
      return node;
    }
  } else if (node.type === 'ExpressionStatement') {
    return getVariablesNode(node.expression);
  } else if (node.type === 'AssignmentExpression') {
    return getVariablesNode(node.right);
  }
}

/**
 * Parse a JavaScript content.
 * It get only the variables. In the future, it will get other patterns.
 *
 * @param {string} data content
 * @returns
 */
function jsParser(data) {
  try {
    const jsObj = { variables: [] };
    const parse = Parser.parse(data, { ecmaVersion: 2020 });
    const variablesNode = getVariablesNode(parse);

    // Get variables
    for (let idx = 0; idx < variablesNode.length; ++idx) {
      const item = variablesNode[idx];
      if (item && item.declarations && item.declarations[0].type === 'VariableDeclarator') {
        const { name } = item.declarations[0].id;
        const { end } = item.declarations[0]; // bytePosition of the last byte
        const value = resolveVariableValue(item.declarations[0].init, jsObj.variables);
        jsObj.variables.push({ name, end, kind: item.kind, typeof: typeof value, value });
      }
    }
    return jsObj;
  } catch (err) {
    return null;
  }
}

/**
 * Parse a ES Module content.
 * It get only the variables. In the future, it will get other patterns.
 *
 * @param {string} data content
 * @param {boolean} onlyPrimitiveTypes
 * @returns
 */
async function jsParserEsModule(data, onlyPrimitiveTypes = true) {
  try {
    let dataAux = data;
    dataAux = dataAux && dataAux.split(new RegExp('(const|let|var)(\\s+.*\\s*=\\s*)'));
    if (dataAux.length > 3) {
      dataAux[0] = `/*${dataAux[0]}*/`;
      for (let idx = 3; idx < dataAux.length; idx += 3) {
        if (dataAux[idx - 1].substr(-1) == '=' && dataAux[idx][0] == '>') {
          // Arrow function
          dataAux[idx - 3] += '/*';
          dataAux[idx] += '*/\n';
          continue;
        }
        let varValue = dataAux[idx];
        if (varValue.split(/^null/).length > 1) {
          // null
          varValue = varValue.split(/^null/);
          varValue = `null\n/*${varValue[1]}*/\n`;
          dataAux[idx] = varValue;
        } else if (varValue.split(/^true/).length > 1) {
          // boolean
          varValue = varValue.split(/^true/);
          varValue = `true\n/*${varValue[1]}*/\n`;
          dataAux[idx] = varValue;
        } else if (varValue.split(/^false/).length > 1) {
          // boolean
          varValue = varValue.split(/^false/);
          varValue = `false\n/*${varValue[1]}*/\n`;
          dataAux[idx] = varValue;
        } else if (varValue.split(/^\d+/).length > 1) {
          // number
          varValue = varValue.split(/^(\d+)/);
          varValue = `${varValue[1]}\n/*${varValue[2]}*/\n`;
          dataAux[idx] = varValue;
        } else if (varValue.split(/^"|^'|^`/).length > 1) {
          // string
          const symbol = varValue[0];
          const str = await handleData.popString(varValue, true);
          varValue = `${symbol + str + symbol}\n/*${varValue.split(symbol + str + symbol)[1]}*/\n`;
          dataAux[idx] = varValue;
        } else if (varValue.split(/^\[|^\{|^\[/).length > 1) {
          // object or array
          const symbol = varValue[0];
          const dat = await utils.stack0SymbolRecognizer(varValue, symbol, null, true);
          varValue = `${dat}\n/*${varValue.split(dat)[1]}*/\n`;
          dataAux[idx] = varValue;
        } else if (varValue.split(/^>/).length == 1) {
          if (onlyPrimitiveTypes) {
            dataAux[idx - 3] += '/*';
            dataAux[idx] += '*/\n';
          } else {
            const varValueAux = varValue.split(/;|\n/);
            if (varValueAux.length > 1) {
              varValue = `${varValueAux[0]}\n/*${varValue.split(varValueAux[0])[1]}*/\n`;
              dataAux[idx] = varValue;
            }
          }
        }
      }
      dataAux = dataAux.join('');
      return jsParser(dataAux);
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Remove a specific character.
 * @param {string} data
 * @param {string} character
 * @param {boolean} ignoreInString If 'true', the 'character' won't be searched in the string.
 * @returns
 */
function removeCharacter(data, character, ignoreInString = true) {
  if (!data) {
    return '';
  }
  let stringType = null;
  let resp = '';
  let c = null;
  for (let idx = 0; idx < data.length; ++idx) {
    c = data[idx];
    if (ignoreInString) {
      if (c == stringType && data[idx - 1] != '\\') {
        stringType = null;
        resp += c;
        continue;
      }
      if (c == "'" && !stringType) {
        stringType = "'";
      } else if (c == '"' && !stringType) {
        stringType = '"';
      } else if (c == '`' && !stringType) {
        stringType = '`';
      }
    }
    if (c !== character || stringType) {
      resp += c;
    }
  }
  return resp;
}

/**
 * Resolve referenced varibles in the path.
 *
 * @param {string} rawPath
 * @param {number} bytePosition
 * @param {*} jsParsed
 * @param {Array} importedFiles
 * @returns
 */
async function resolvePathVariables(rawPath, bytePosition, jsParsed, importedFiles) {
  if (!rawPath) {
    return rawPath;
  }

  if (rawPath) {
    rawPath = rawPath.replaceAll(' ', '');
  }
  try {
    let pathVariables = await handleData.removeStrings(rawPath);
    if (
      rawPath &&
      (rawPath.includes('${') || pathVariables.length > 0) &&
      jsParsed &&
      jsParsed.variables &&
      jsParsed.variables.length > 0
    ) {
      pathVariables = pathVariables.split('+').filter(e => e != '' && e != ' ');
      let auxPath = rawPath.replaceAll(' ', '').split(new RegExp('\\$\\{'));
      auxPath.shift();
      auxPath = [...auxPath, ...pathVariables];
      for (let index = 0; index < auxPath.length; ++index) {
        const e = auxPath[index];
        const varName = e.split(new RegExp('\\}|\\+\\"|\\+\'|\\+\\`'))[0];
        let varKey = varName.split('.')[0];
        let resolvedVariables = jsParsed.variables.filter(
          v => v.name == varKey && v.end <= bytePosition,
        );
        const exportPath = null;
        if (!resolvedVariables || resolvedVariables.length == 0) {
          // Variable in other file
          const idx = importedFiles.findIndex(
            e => e.varFileName && varKey && e.varFileName == varKey,
          );
          if (idx == -1) {
            // Second, tries to find in the 'exports' of import/require, such as 'foo' in the: import { foo } from './fooFile'
            importedFiles.forEach(imp => {
              if (exportPath) {
                return;
              }
              const found =
                imp && imp.exports
                  ? imp.exports.find(e => e.varName && varKey && e.varName == varKey)
                  : null;
              if (found) {
                // TODO
              }
            });
          } else {
            const pathFile = importedFiles[idx].fileName;
            const extension = await utils.getExtension(pathFile);
            const fileContent = await utils.getFileContent(pathFile + extension);
            const jsExternalParsed = jsParser(await handleData.removeComments(fileContent, true));
            if (varName.includes('.')) {
              varKey = varName.split('.')[1];
            }

            resolvedVariables = jsExternalParsed.variables.filter(
              v => v.name == varKey && v.end <= bytePosition,
            );
          }
        }

        if (resolvedVariables && resolvedVariables.length > 0) {
          resolvedVariables.sort(function (a, b) {
            return b.end - a.end;
          }); // Get variable in the nearest scope
          let value = null;
          if (varName.split('.').length > 1 && resolvedVariables[0].typeof == 'object') {
            value = searchInObject(
              resolvedVariables[0].value,
              varName.split('.').slice(1).join('.'),
            );
          } else {
            value = resolvedVariables[0].value;
          }

          if (rawPath === varName) {
            // Just the variable in the path
            rawPath = value;
          } else {
            rawPath = rawPath.replaceAll(`\${${varName}}`, value);
            rawPath = rawPath.replaceAll(`+${varName}`, `+${value}`);
            rawPath = rawPath.replaceAll(`${varName}+`, `${value}+`);
          }
        }
      }
    }
    if (rawPath) {
      rawPath = removeCharacter(rawPath, '+'); // Removingo '+' outside of strings. Avoinding problems such as: '/path_regex/:foo([a-z]+)'
      rawPath = rawPath.replaceAll("'", '').replaceAll('"', '').replaceAll('`', '');
    }

    return rawPath;
  } catch (err) {
    return rawPath;
  }
}

/**
 * Resolve the value of a specific variable.
 * @param {*} node
 * @param {Array} variables variables that can be in the node.
 * @returns
 */
function resolveVariableValue(node, variables) {
  try {
    if (node.type === 'ObjectExpression') {
      const v = {};
      if (Array.isArray(node.properties)) {
        for (let idx = 0; idx < node.properties.length; ++idx) {
          const item = node.properties[idx];
          const value = resolveVariableValue(item.value);
          const { name } = item.key;
          v[name] = value;
        }
      }
      return v;
    }
    if (node.type === 'BinaryExpression') {
      const left = resolveVariableValue(node.left, variables);
      const right = resolveVariableValue(node.right, variables);
      return left + right;
    }
    if (node.type === 'Literal') {
      if (typeof node.value === 'string') {
        return `${node.value}`;
      }
      if (typeof node.value === 'number') {
        return node.value;
      }
    } else if (node.type === 'Identifier') {
      return variables[node.name];
    } else {
      return '';
    }
  } catch (err) {
    return '';
  }
}

/**
 * Search a variable value in an object.
 * @param {object} obj
 * @param {string} property
 * @returns
 */
function searchInObject(obj, property) {
  if (property === '') {
    return obj;
  }
  try {
    const value = property.split('.')[0];
    const nextValue = property.split('.').slice(1).join('.');
    if (obj[value]) {
      return searchInObject(obj[value], nextValue);
    }
    if (obj.value && obj.value[value]) {
      return searchInObject(obj.value[value], nextValue);
    }
    return null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  getUntil,
  getVariablesNode,
  jsParser,
  jsParserEsModule,
  removeCharacter,
  resolvePathVariables,
  resolveVariableValue,
  searchInObject,
};
