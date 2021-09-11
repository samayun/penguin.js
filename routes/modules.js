const fs = require("fs");
const { resolve, join } = require("path");
const module_path = resolve(__dirname, "./../modules");

const modules = fs.readdirSync(module_path);

module.exports = (app) => {
  modules.forEach((mod) => {
    const route_path = join(module_path, mod);
    require(`${route_path}/routes`)(app);
  });
};
