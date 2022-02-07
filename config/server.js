require('dotenv').config();

module.exports = {
  host: process.env.HOST || 'http://127.0.0.1',
  port: process.env.PORT || 5000,
};
