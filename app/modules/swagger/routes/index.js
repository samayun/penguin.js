const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('../output/swagger_output.json');

const router = require('express').Router();

module.exports = () => {
    router.use(swaggerUi.serve, swaggerUi.setup(swaggerFile));

    return router;
};
