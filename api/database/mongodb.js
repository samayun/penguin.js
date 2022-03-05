const mongoose = require('mongoose');

const {
  mongodb: { prefix, url, host, username, port, password, database, suffix },
} = require('../config/database').connections;

module.exports = async function connectDB() {
  try {
    let uri;
    if (url) {
      uri = url;
    } else if (port) {
      uri = `${prefix}${username}:${password}@${host}:${port}/${database}${suffix}`;
    } else {
      uri = `${prefix}${username}:${password}@${host}/${database}${suffix}`;
    }

    const options = { useNewUrlParser: true, useUnifiedTopology: true };

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`🧠 Connecting to ${uri}`);
    }
    await mongoose.connect(uri, options);
    return Promise.resolve(`Database Connected`);
  } catch (error) {
    return Promise.reject(error.message);
  }
};
// make a reusable multiple database connectivity functionalities here
