const { Types } = require('mongoose');

module.exports = () => {
  const path = '/v1/consumers';
  const router = require('express').Router();
  const service = require('../service');

  router.get('/', async (req, res, next) => {
    /* #swagger.tags = ['consumer'] */
    try {
      const data = await service.findMany();

      return res.status(200).json({ success: true, message: 'Get all ', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.post('/', async (req, res, next) => {
    /* #swagger.tags = ['consumer'] */
    try {
      const data = await service.create({
        consumerTitle: req.body.consumerTitle,
        provider: {
          _id: new Types.ObjectId(req.body.providerId),
        },
      });

      return res.status(200).json({ success: true, message: 'create ', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.put('/:id', async (req, res, next) => {
    /* #swagger.tags = ['consumer'] */
    try {
      const data = await service.update(req.params.id, {
        title: req.body.title,
        description: req.body.description,
      });

      return res.status(200).json({ success: true, message: 'update', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.delete('/:id', async (req, res, next) => {
    /* #swagger.tags = ['consumer'] */
    try {
      const data = await service.delete(req.params.id);

      return res.status(200).json({ success: true, message: 'delete', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.delete('/bulk', async (req, res, next) => {
    /* #swagger.tags = ['consumer'] */
    try {
      const data = await service.deleteBulk();

      return res.status(200).json({ success: true, message: 'delete all ', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  return { path, router };
};
