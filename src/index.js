/* eslint-disable no-console  */

require('dotenv').config();
const express = require('express');

const app = express();
const { host, port } = require('./config/server');

const connectDB = require('./database/connection');

// SETUP MIDDLEWARES
const setMiddlewares = require('./app/middlewares');

setMiddlewares(app);

// USING ROUTES from Routes Directory
const setRoutes = require('./routes');

setRoutes(app);

(async function main() {
  try {
    // Connect Database
    await connectDB();
    /*
     * Listen to server
     */
    await app.listen(port, host);
    console.log(
      '\x1b[47m\x1b[46m%s\x1b[0m',
      `🧠 Server running on 👀`,
      '\x1b[1m\x1b[5m',
      `http://${host}:${port}`,
    );
    console.log(
      '\x1b[46m\x1b[46m%s\x1b[2m',
      `🧠 Swagger documentation is here  👀`,
      '\x1b[1m\x1b[5m',
      `http://${host}:${port}/docs`,
    );
  } catch (error) {
    console.log(error || 'Server Down');
  }
})();

module.exports = app;
