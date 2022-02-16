const { JWT } = require('jwt-auth-helper');
const router = require('express').Router();

const authService = require('../services/authService');
const authenticate = require('../../../app/middlewares/isAuth');
const { registerValidator, loginValidator } = require('../validator/auth.validator');

const jwt = new JWT(process.env.JWT_SECRET_KEY || 'JWT_SECRET_KEY');

const path = '/v1/auth';

module.exports = () => {
  router.post('/login', loginValidator, async (req, res, next) => {
    /* #swagger.tags = ['Authentication']
     	#swagger.basePath = '/v1/auth'
        #swagger.description = 'Sign in a specific user'

        	#swagger.parameters['obj'] = {
            in: 'body',
            description: 'User information.',
            required: true,
            schema: { $ref: "#/definitions/AddUser" }
    } */
    try {
      const user = await authService.login({
        email: req.body.email,
        password: req.body.password,
      });
      // generate access token
      const accessToken = await jwt.generateJWTToken({ ...user });

      res.json({
        status: 'success',
        message: `${user.name} logged in successfully`,
        data: user,
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/register', registerValidator, async (req, res, next) => {
    /* 	#swagger.tags = ['Authentication']
        #swagger.description = 'Endpoint to sign up a specific user' */
    try {
      const user = await authService.register(req.body);
      // generate access token
      const accessToken = await jwt.generateJWTToken({ ...user });

      res.json({
        status: 'success',
        message: `${user.name} register successfully`,
        data: accessToken,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/profile', authenticate, async (req, res, next) => {
    try {
      res.json({
        status: 'success',
        message: `Valid profile`,
        data: await authService.profile(req.user.email),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/users', authenticate, async (req, res, next) => {
    try {
      res.json({
        status: 'success',
        message: `Valid profile`,
        data: await authService.getUsers(),
      });
    } catch (error) {
      next(error);
    }
  });
  return {
    path,
    router,
  };
};
