const fs = require('fs');
const { resolve, join } = require('path');

module.exports = () => {
    let routes = [];
    const modulePath = resolve(`${__dirname}`);
    const modules = fs.readdirSync(modulePath);
    const routers = modules
        .map(mod => {
            const routePath = join(modulePath, mod);
            // If only modules have routes_directory/index.js means it's RESTful route
            // otherwise It may be utilities module or GraphQL based modules
            if (fs.existsSync(routePath + '/routes/index.js')) {
                routes.push(`${routePath}/routes/index.js`);
                return require(routePath + '/routes/index')();
            }
        })
        .filter(mod => !!mod);

    return {
        routes,
        routers
    };
};
