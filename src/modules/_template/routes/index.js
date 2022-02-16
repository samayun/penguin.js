const path = '/v1/tests';
const router = require('express').Router();

module.exports = () => {
  router.get('/', (_, res) => {
    /* #swagger.tags = ['.template'] */
    return res.status(200).json({
      success: true,
      message: 'Get all tests',
      data: [],
    });
  });

  return {
    path,
    router,
  };
};
