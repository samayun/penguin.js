const service = require('../service/CategoryService');

module.exports = () => {
  const path = '/v1/categories';
  const router = require('express').Router();

  router.get('/', async (_, res) => {
    /* #swagger.tags = ['Category'] */
    const data = await service.findMany();

    return res.status(200).json({ success: true, message: 'Get all categories', data });
  });

  router.post('/', async (req, res) => {
    /* #swagger.tags = ['Category'] */
    const data = await service.create({
      title: req.body.title,
    });

    return res.status(200).json({ success: true, message: 'create categories', data });
  });

  return { path, router };
};
