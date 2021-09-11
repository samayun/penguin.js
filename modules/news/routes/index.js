const router = require("express").Router();
// manual import
const News = require("../models/News.model");
const { createNewsValidator } = require("../validator/news.validator");
const newsService = require("../services/news.service")(News);

module.exports = (routes) => {
  routes.use("/api/news", router);
  /**
   * @swagger
   * /api/news:
   *   get:
   *     summary: News Route
   *     responses:
   *       200:
   */
  router.get("/", async (req, res, next) => {
    try {
      return res.json({
        success: true,
        message: "Get all news",
        data: await newsService.getAll(),
      });
    } catch (error) {
      next(error);
    }
  });
  // POST /api/news
  router.post("/", createNewsValidator, async (req, res, next) => {
    try {
      return res.json({
        success: true,
        message: "Create a news",
        data: await newsService.create(req.body),
      });
    } catch (error) {
      next(error);
    }
  });
  // GET /api/news/update/:id
  router.put("/update/:id", async (req, res, next) => {
    try {
      return res.json({
        success: true,
        message: "Get all news",
        data: await newsService.update(req.params.id, req.body),
      });
    } catch (error) {
      next(error);
    }
  });
  // GET /api/news/show?_id=aeb54 | email=samu@gmail.com | slug=test
  router.get("/show", async (req, res, next) => {
    try {
      if (req.query.email || req.query._id || req.query.slug) {
        return res.json({
          success: true,
          message: "Get one news",
          data: await newsService.getOne(req.query),
        });
      }
      return next(new Error("Please send _id,email or other credentials"));
    } catch (error) {
      next(error);
    }
  });
  // PUT /api/news/update/?_id=aeb54 | email=samu@gmail.com | slug=test
  router.put("/update", async (req, res, next) => {
    try {
      if (req.query.email || req.query._id || req.query.slug) {
        return res.json({
          success: true,
          message: "update one news",
          data: await newsService.update(req.query, req.body),
        });
      }
      return next(new Error("Please send _id,email or other credentials"));
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/news/update/?_id=aeb54 | email=samu@gmail.com | slug=test
  router.delete("/delete", async (req, res, next) => {
    try {
      if (req.query.email || req.query._id || req.query.slug) {
        return res.json({
          success: true,
          message: "Delete one news",
          data: await newsService.deleteOne(req.query),
        });
      }
      return next(new Error("Please send _id,email or other credentials"));
    } catch (error) {
      next(error);
    }
  });
};
