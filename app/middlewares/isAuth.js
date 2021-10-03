const { JWT } = require("jwt-auth-helper");
const jwt = new JWT(process.env.JWT_SECRET_KEY || "JWT_SECRET_KEY");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      req.isAuth = false;

      let error = new Error("Unauthenticated");
      error.status = 401;
      return next(error);
    }

    // authHeader : Bearer asjdgshjgfjhgfdajshg
    const token = authHeader && authHeader.split(" ")[1];
    if (!token || token == null || token == "") {
      req.isAuth = false;

      let error = new Error("Unauthenticated");
      error.status = 401;
      return next(error);
    }
    const decodedAuthData = jwt.verifyToken(token);

    if (!decodedAuthData) {
      req.isAuth = false;
      let error = new Error("Token is malicious");
      error.status = 401;
      return next(error);
    }

    req.isAuth = true;
    req.user = decodedAuthData._doc;
    return next();
  } catch (error) {
    next(error);
  }
};
module.exports = authenticate;
