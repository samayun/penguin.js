const testService = require('../service/TestService');

module.exports = () => {
  const path = '/v1/tests';
  const router = require('express').Router();

  router.get('/', async (_, res) => {
    /* #swagger.tags = ['.template'] */
    const data = await testService.getTests();

    return res.status(200).json({ success: true, message: 'Get all tests', data });
  });

  router.post('/', async (req, res) => {
    /* #swagger.tags = ['.template'] */
    const data = await testService.create({
      title: req.body.title,
      category: req.body.category,
    });

    return res.status(200).json({ success: true, message: 'create test', data });
  });

  return { path, router };
};
