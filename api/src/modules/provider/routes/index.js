module.exports = () => {
  const path = '/v1/providers';
  const router = require('express').Router();
  const service = require('../service');

  router.get('/', async (req, res, next) => {
    try {
      /* #swagger.tags = ['provider'] */
      const data = await service.findMany();

      return res.status(200).json({ success: true, message: 'Get all providers', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.post('/', async (req, res, next) => {
    /* #swagger.tags = ['provider'] */
    try {
      const data = await service.create({
        // title: req.body.title,
        providerTitle: req.body.providerTitle,
        auth: {
          name: req.body.name,
          phone: req.body.phone,
        },
      });

      return res.status(200).json({ success: true, message: 'create provider', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.put('/:id', async (req, res, next) => {
    /* #swagger.tags = ['provider'] */
    try {
      const data = await service.update(req.params.id, {
        providerTitle: req.body.providerTitle,
        auth: {
          name: req.body.name,
          phone: req.body.phone,
        },
      });

      return res.status(200).json({ success: true, message: 'update provider', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.delete('/:id', async (req, res, next) => {
    /* #swagger.tags = ['provider'] */
    try {
      const data = await service.delete(req.params.id);

      return res.status(200).json({ success: true, message: 'delete provider', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.delete('/bulk', async (req, res, next) => {
    /* #swagger.tags = ['provider'] */
    try {
      const data = await service.deleteBulk();

      return res.status(200).json({ success: true, message: 'delete all ', data });
    } catch (error) {
      next(new Error('FAILED'));
    }
  });

  return { path, router };
};
