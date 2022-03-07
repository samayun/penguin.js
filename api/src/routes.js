/* eslint-disable no-unused-expressions  */
// import Routes from modules or global place
const loadModules = require('./modules');
const swaggerModule = require('./app/modules/swagger/routes');
const { swaggerRoutePrefix, apiRoutePrefix } = require('./config/api');

const routes = [
  {
    name: 'Dynamic Modules',
    type: 'module',
    prefix: apiRoutePrefix,
    handler: loadModules,
  },

  {
    path: '/',
    handler: (req, res) => {
      res.json({
        status: 'All is well 🐦',
        site: 'Penguin.js monolithic framework',
        docs: `http://${req.headers.host}${swaggerRoutePrefix}`,
        author: {
          name: 'Samayun Miah Chowdhury',
          email: 'samayun.m.chowdhury@gmail.com',
          github: 'https://github.com/samayun',
          linkedin: 'https://www.linkedin.com/in/samayun',
        },
      });
    },
  },
  {
    name: 'Swagger Route',
    path: swaggerRoutePrefix,
    handler: swaggerModule(),
  },
  {
    name: 'Not Found',
    path: '*',
    handler: (req, res) => {
      res.status(404).json({ success: false, message: 'Endpoint Not Found 😢', data: null });
    },
  },
  /*
   *  Error handling middleware
   */
  {
    name: 'Error Boundary',
    path: '*',
    // eslint-disable-next-line no-unused-vars
    handler: (error, req, res, next) => {
      let code;
      if (error.status === 404) {
        code = 404;
        return res
          .status(code)
          .json({ success: false, message: 'Something went wrong 😢', data: null });
      }
      // eslint-disable-next-line no-console
      // process.env.NODE_ENV === 'development' && console.error(error.message);

      return res.status(code || 500).json({
        success: false,
        name: error.name || 'Error Ocurred 😢',
        message: error.message || 'Internal Server Error 😢',
        code: error.status || 500,
        data: null,
      });
    },
  },
];

module.exports = app => {
  routes.forEach(route => {
    if (route.path === '/') {
      // root route
      app.get(route.path, route.handler);
    } else if (route.type === 'module') {
      // accepted moduler routes
      const handlers = route.handler();

      handlers.routers.forEach(({ path, router }) => {
        app.use(`${route.prefix}${path}`, router);
      });
    } else if (route.path) {
      // rest routes for RESTful API
      app.use(route.path, route.handler);
    } else {
      app.use(route.handler);
    }
  });
};
