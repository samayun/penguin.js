const path = '/v1/categories';
const router = require('express').Router();

module.exports = () => {
    router.get('/hello', (req, res, next) => {
        /* #swagger.tags = ['User']
     	#swagger.basePath = '/v1/auth'
         #swagger.description = 'XXXXXXXXXXXX'
         */
        res.status(200).json({
            message: 'TEmp Swagger Docs'
        });
    });

    return {
        path,
        router
    };
};
