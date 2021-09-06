const mongoose = require("mongoose");

module.exports = async function connectDB() {
  try {
    const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?retryWrites=true&w=majority`;
    const options = { useNewUrlParser: true, useUnifiedTopology: true };

    await mongoose.connect(uri, options);
    return Promise.resolve(`DB Connected`);
  } catch (error) {
    return Promise.reject(error.message);
  }
};
// make a reusable multiple database connectivity functionalities here
