const path = '/v1/tests';
const router = require('express').Router();

module.exports = () => {
    router.get('/', (req, res, next) => {
        /* #swagger.tags = ['__template'] */
        res.status(200).json({
            message: 'TEmp Swagger Docs'
        });
    });

    return {
        path,
        router
    };
};
