require('dotenv').config();
const express = require('express');
const app = express();
const { host, port } = require('./config/server');

const connectDB = require('./database/connection');

// SETUP MIDDLEWARES
const setMiddlewares = require('./app/middlewares');
setMiddlewares(app);

// USING ROUTES from Routes Directory
const setRoutes = require('./routes.js');
setRoutes(app);

(async function main() {
    try {
        // Connect Database
        const client = await connectDB();

        console.log(client);
        /*
         * Listen to server
         */
        app.listen(port, () => console.log(`${host}:${port}`));
    } catch (error) {
        console.log(error || 'Server Down');
    }
})();

module.exports = app;
