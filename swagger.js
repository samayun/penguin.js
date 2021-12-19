const swaggerAutogen = require('swagger-autogen')();
const app = require('./server');
const modules = require('./modules');
console.log({ modules: modules });

const doc = {
    info: {
        version: '1.0.1',
        title: 'API Swagable',
        description: 'Documentation automatically generated by the <b>swagger-autogen</b> module.'
    },
    host: 'localhost:2000',
    basePath: '/api',
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
        {
            name: 'User',
            description: 'Endpoints'
        }
    ]
};

const outputFile = './modules/swagger/dto/swagger_output.json';

const endpointRoutes = modules(app);

swaggerAutogen(outputFile, endpointRoutes, doc).then(({ data }) => {
    console.log('DONE\n', data);
});
