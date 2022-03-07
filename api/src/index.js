/* eslint-disable no-console  */

require('dotenv').config();
const express = require('express');

const app = express();
const { host, port } = require('./config/server');

const connectDB = require('./database/connection');

const loadMiddlewares = require('./app/middlewares');

const loadDynamicRoutes = require('./routes');

(async function main() {
  try {
    await connectDB();

    loadMiddlewares(app);

    loadDynamicRoutes(app);

    await app.listen(port);

    console.log(
      '\x1b[47m\x1b[46m%s\x1b[0m',
      `🧠 Server running on 👀`,
      '\x1b[1m\x1b[5m',
      `http://${host}`,
    );
    console.log(
      '\x1b[46m\x1b[46m%s\x1b[2m',
      `🧠 Swagger documentation is here  👀`,
      '\x1b[1m\x1b[5m',
      `http://${host}/docs`,
    );
  } catch (error) {
    console.log(error.message || 'Server Down');
  }
})();

module.exports = app;
