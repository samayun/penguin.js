const cors = require('cors');
const express = require('express');

const middlewares = [
  cors(),
  express.json({ limit: '2048mb' }),
  express.urlencoded({
    limit: '2048mb',
    extended: false,
  }),

  express.static('public'),
  express.static('uploads'),
];

module.exports = app => {
  middlewares.forEach(middleware => {
    app.use(middleware);
  });
};
