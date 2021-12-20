// require("dotenv").config();

const { JWT } = require('jwt-auth-helper');
const authenticate = require('../../../app/middlewares/isAuth');
const authService = require('../services/authService');

const { registerValidator, loginValidator } = require('../validator/auth.validator');

const jwt = new JWT(process.env.JWT_SECRET_KEY || 'JWT_SECRET_KEY');

const path = '/v1/auth';
const router = require('express').Router();

module.exports = () => {
    router.get('/test', (req, res, next) => {
        /* #swagger.tags = ['Authentication']
     	#swagger.basePath = '/v1/auth'
         #swagger.description = 'XXXXXXXXXXXX'
         */
        res.status(200).json({
            message: 'TEST Swagger Docs'
        });
    });
    router.get('/hello2', (req, res, next) => {
        /* #swagger.tags = ['Authentication']
     	#swagger.basePath = '/v1/auth'
         #swagger.description = 'XXXXXXXXXXXX'
         */
        res.status(200).json({
            message: 'TEST Swagger Docs'
        });
    });
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
                password: req.body.password
            });
            // generate access token
            const access_token = await jwt.generateJWTToken({ ...user });

            res.json({
                status: 'success',
                message: `${user.name} logged in successfully`,
                data: user,
                access_token
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
    router.post('/register', registerValidator, async (req, res, next) => {
        /* 	#swagger.tags = ['Authentication']
        #swagger.description = 'Endpoint to sign up a specific user' */
        try {
            const user = await authService.register(req.body);
            // generate access token
            const access_token = await jwt.generateJWTToken({ ...user });

            res.json({
                status: 'success',
                message: `${user.name} register successfully`,
                data: access_token
            });
        } catch (error) {
            next(error);
        }
    });
    // GET /api/auth/profile
    router.get('/profile', authenticate, async (req, res, next) => {
        try {
            res.json({
                status: 'success',
                message: `Valid profile`,
                data: await authService.profile(req.user.email)
            });
        } catch (error) {
            next(error);
        }
    });
    // GET /api/auth/users
    router.get('/users', authenticate, async (req, res, next) => {
        try {
            res.json({
                status: 'success',
                message: `Valid profile`,
                data: await authService.getUsers()
            });
        } catch (error) {
            next(error);
        }
    });
    return {
        path,
        router
    };
};
