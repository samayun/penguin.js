const router = require("express").Router();
// manual import

module.exports = (routes) => {
  routes.use("/api/media", router);

  router.get("/", async (req, res, next) => {
    try {
      return res.json({
        success: true,
        message: "Ping",
        data: "Pong",
      });
    } catch (error) {
      next(error);
    }
  });
};
