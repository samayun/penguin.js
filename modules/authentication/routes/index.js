// require("dotenv").config();
const router = require("express").Router();
const { JWT } = require("jwt-auth-helper");
const authenticate = require("../../../app/middlewares/isAuth");
const authService = require("../services/authService");

const {
  registerValidator,
  loginValidator,
} = require("../validator/auth.validator");

const jwt = new JWT(process.env.JWT_SECRET_KEY || "JWT_SECRET_KEY");

module.exports = (routes) => {
  routes.use("/api/auth", router);

  // POST /api/auth/login
  router.post("/login", loginValidator, async (req, res, next) => {
    try {
      const user = await authService.login({
        email: req.body.email,
        password: req.body.password,
      });
      // generate access token
      const access_token = await jwt.generateJWTToken({ ...user });

      res.json({
        status: "success",
        message: `${user.name} logged in successfully`,
        data: user,
        access_token,
      });
    } catch (error) {
      console.log(error);
      next(error);
    }
  });

  /**
   *  POST /api/auth/register
   * { name : "Salman Akash", email: "samu@gmail.com, password: "123456"}
   *  */
  router.post("/register", registerValidator, async (req, res, next) => {
    try {
      const user = await authService.register(req.body);
      console.log(user);
      // generate access token
      const access_token = await jwt.generateJWTToken({ ...user });

      res.json({
        status: "success",
        message: `${user.name} register successfully`,
        data: access_token,
      });
    } catch (error) {
      next(error);
    }
  });
  // GET /api/auth/profile
  router.get("/profile", authenticate, async (req, res, next) => {
    try {
      const user = await authService.profile(req.user.email);
      console.log(user);

      res.json({
        status: "success",
        message: `Valid profile`,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  });
  // GET /api/auth/users
  router.get("/users", authenticate, async (req, res, next) => {
    try {
      const data = await authService.users();

      res.json({
        status: "success",
        message: `Valid profile`,
        data,
      });
    } catch (error) {
      next(error);
    }
  });
};
