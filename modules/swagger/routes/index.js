const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('../dto/swagger_output.json');

const router = require('express').Router();

module.exports = () => {
    router.use(swaggerUi.serve, swaggerUi.setup(swaggerFile));

    return {
        path: '/v1/docs',
        router
    };
};
