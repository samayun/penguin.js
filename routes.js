// import Routes from modules or global place
const modules = require('./modules');
const swaggerModule = require('./app/modules/swagger/routes');

const routes = [
    {
        name: 'modules',
        type: 'module',
        handler: modules
    },

    {
        path: '/',
        handler: (req, res) => {
            res.json({
                title: 'Welcome, you are genius. All is well 😃'
            });
        }
    },
    {
        name: 'Swagger Route',
        path: '/docs',
        handler: swaggerModule()
    },
    {
        name: 'Not Found',
        path: '*',
        handler: (req, res) => {
            res.status(404).json({ error: 'Endpoint Not Found 😢😢' });
        }
    },
    /*
     *  Error handling middleware
     */
    {
        name: 'Error Boundary',
        path: '*',
        handler: (error, req, res, next) => {
            if (error.status === 404) {
                return res.status(404).json({ error: 'Endpoint Not Found 😢' });
            }
            process.env.NODE_ENV === 'development' && console.error(error.message);

            return res.json({
                name: error.name || 'Error Ocurred 😢',
                message: error.message || 'Internal Server Error 😢',
                status: error.status || 500
            });
        }
    }
];

module.exports = app => {
    routes.forEach(route => {
        if (route.path === '/') {
            // root route
            app.get(route.path, route.handler);
        } else if (route.type === 'module') {
            // accepted moduler routes
            const handlers = route.handler();

            handlers.routers.forEach(({ path, router }) => {
                app.use('/api' + path, router);
            });
        } else if (route.path) {
            // rest routes for RESTful API
            app.use(route.path, route.handler);
        } else {
            app.use(route.handler);
        }
    });
};
