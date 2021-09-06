const router = require("express").Router();
// manual import

module.exports = (routes) => {
  routes.use("/api/todos", router);

  router.get("/test", async (req, res, next) => {
    try {
      return res.json("Todos");
    } catch (error) {
      next(error);
    }
  });
};
