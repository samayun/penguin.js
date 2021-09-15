const fs = require("fs");
const { resolve, join } = require("path");
const module_path = resolve(__dirname, "./../modules");

const modules = fs.readdirSync(module_path);

module.exports = (app) => {
  modules.forEach(async (mod) => {
    const route_path = join(module_path, mod);
    // If only modules have routes_directory/index.js means it's RESTful route
    // otherwise It may be utilities module or GrapQL based modules
    if (fs.existsSync(`${route_path}/routes`)) {
      require(`${route_path}/routes`)(app);
    }
  });
};
