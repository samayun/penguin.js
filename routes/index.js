// import Routes from modules or global place
const authRoutes = require("../modules/authentication/routes");
const taskRoutes = require("../modules/task/routes");

const routes = [
  {
    name: "authRoutes",
    type: "module",
    handler: authRoutes,
  },
  {
    name: "taskRoutes",
    type: "module",
    handler: taskRoutes,
  },
  {
    name: "newsRoutes",
    type: "module",
    handler: require("../modules/news/routes"),
  },
  {
    name: "swaggerRoutes",
    type: "module",
    handler: require("../modules/swagger/routes"),
  },
  /**
   * @swagger
   * /:
   *   get:
   *     summary: Home Route
   *     responses:
   *       200:
   */

  {
    path: "/",
    handler: (req, res) => {
      res.json({
        title: "Welcome, you are genius. All is well 😃",
      });
    },
  },
  {
    name: "Not Found",
    path: "*",
    handler: (req, res) => {
      res.status(404).json({ error: "Endpoint Not Found 😢😢" });
    },
  },
  /*
   *  Error handling middleware
   */
  {
    name: "Error Boundary",
    path: "*",
    handler: (error, req, res, next) => {
      if (error.status === 404) {
        return res.status(404).json({ error: "Endpoint Not Found 😢" });
      }
      process.env.NODE_ENV === "developement" && console.error(error.message);

      return res.json({
        name: error.name || "Error Occured 😢",
        message: error.message || "Internel Server Error 😢",
        status: error.status || 500,
      });
    },
  },
];

module.exports = (app) => {
  routes.forEach((route) => {
    if (route.path === "/") {
      // root route
      app.get(route.path, route.handler);
    } else if (route.type === "module") {
      // accepted moduler routes
      route.handler(app);
    } else {
      // rest routes for RESTful API
      app.use(route.path, route.handler);
    }
  });
};
