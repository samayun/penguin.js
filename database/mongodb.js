const mongoose = require("mongoose");

module.exports = async function connectDB() {
    try {
        const uri = `${process.env.DB_PRE_PROTOCOL}${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}${process.env.DB_EXTRA}`;
        const options = { useNewUrlParser: true, useUnifiedTopology: true };
        console.log(uri)
        await mongoose.connect(uri, options);
        return Promise.resolve(`Database Connected`);
    } catch (error) {
        return Promise.reject(error.message);
    }
};
// make a reusable multiple database connectivity functionalities here
