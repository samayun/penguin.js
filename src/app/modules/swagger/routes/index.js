/* eslint-disable import/no-unresolved */
const router = require('express').Router();
const swaggerUi = require('swagger-ui-express');

const swaggerFile = require('../output/swagger_output.json');

module.exports = () => {
  router.use(swaggerUi.serve, swaggerUi.setup(swaggerFile));

  return router;
};
