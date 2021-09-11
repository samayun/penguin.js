module.exports = async function connectDB() {
  try {
    // connection codes
    return Promise.resolve(`Database Connected`);
  } catch (error) {
    return Promise.reject(error.message);
  }
};
// make a reusable multiple database connectivity functionalities here
