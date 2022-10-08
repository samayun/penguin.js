const { Types } = require('mongoose');

module.exports = () => {
  const path = '/v1/tests';
  const router = require('express').Router();
  const service = require('../repository');

  router.get('/', async (req, res, next) => {
    try {
      /* #swagger.tags = ['.template'] */
      const data = await service.findMany();

      return res.status(200).json({ success: true, message: 'Get all tests', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.post('/', async (req, res, next) => {
    /* #swagger.tags = ['.template'] */
    try {
      const data = await service.create({
        title: req.body.title,
        category: new Types.ObjectId(req.body.category),
      });

      return res.status(200).json({ success: true, message: 'create test', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.put('/:id', async (req, res, next) => {
    /* #swagger.tags = ['.template'] */
    try {
      const data = await service.update(req.params.id, {
        title: req.body.title,
        category: new Types.ObjectId(req.body.category),
      });

      return res.status(200).json({ success: true, message: 'update test', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.delete('/:id', async (req, res, next) => {
    /* #swagger.tags = ['.template'] */
    try {
      const data = await service.delete(req.params.id);

      return res.status(200).json({ success: true, message: 'delete test', data });
    } catch (error) {
      next(new Error(error.message));
    }
  });

  router.delete('/bulk', async (req, res, next) => {
    /* #swagger.tags = ['.template'] */
    try {
      const data = await service.deleteBulk();

      return res.status(200).json({ success: true, message: 'delete all ', data });
    } catch (error) {
      next(new Error('FAILED'));
    }
  });

  return { path, router };
};
