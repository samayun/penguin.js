const {
  mongodb: { prefix, url, host, username, port, password, database, suffix },
} = require("../config/database").connections;
const mongoose = require("mongoose");

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
    await mongoose.connect(uri, options);
    return Promise.resolve(`Database Connected`);
  } catch (error) {
    return Promise.reject(error.message);
  }
};
// make a reusable multiple database connectivity functionalities here
