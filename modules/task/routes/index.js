const Task = require('../models/Task.model');
const taskService = require('../services/task.service')(Task);

const path = '/v1/tasks';
const router = require('express').Router();

module.exports = () => {
    router.get('/', async (req, res, next) => {
        /* #swagger.tags = ['tasks'] */
        try {
            return res.json({
                success: true,
                message: 'Get all task',
                data: await taskService.getAll()
            });
        } catch (error) {
            next(error);
        }
    });

    router.post('/', async (req, res, next) => {
        /* #swagger.tags = ['tasks'] */
        try {
            return res.json({
                success: true,
                message: 'Get all task',
                data: await taskService.create(req.body)
            });
        } catch (error) {
            next(error);
        }
    });

    router.put('/update/:id', async (req, res, next) => {
        /* #swagger.tags = ['tasks'] */
        try {
            return res.json({
                success: true,
                message: 'Get all task',
                data: await taskService.update(req.params.id, req.body)
            });
        } catch (error) {
            next(error);
        }
    });

    router.get('/show', async (req, res, next) => {
        /* #swagger.tags = ['tasks'] */
        try {
            if (req.query.email || req.query._id || req.query.slug) {
                return res.json({
                    success: true,
                    message: 'Get one task',
                    data: await taskService.getOne(req.query)
                });
            }
            return next(new Error('Please send _id,email or other credentials'));
        } catch (error) {
            next(error);
        }
    });

    router.put('/update', async (req, res, next) => {
        /* #swagger.tags = ['tasks'] */
        try {
            if (req.query.email || req.query._id || req.query.slug) {
                return res.json({
                    success: true,
                    message: 'update one task',
                    data: await taskService.update(req.query, req.body)
                });
            }
            return next(new Error('Please send _id,email or other credentials'));
        } catch (error) {
            next(error);
        }
    });

    router.delete('/delete', async (req, res, next) => {
        /* #swagger.tags = ['tasks'] */
        try {
            if (req.query.email || req.query._id || req.query.slug) {
                return res.json({
                    success: true,
                    message: 'Delete one task',
                    data: await taskService.deleteOne(req.query)
                });
            }
            return next(new Error('Please send _id,email or other credentials'));
        } catch (error) {
            next(error);
        }
    });

    return {
        path,
        router
    };
};
