require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;
const connectDB = require("./database/connection");

// SETUP MIDDLEWARES
const setMiddlewares = require("./app/middlewares");
setMiddlewares(app);

// USING ROUTES from Routes Directory
const setRoutes = require("./routes");
setRoutes(app);

// Connect Database
connectDB()
  .then((client) => {
    console.log(client);
    /*
     * Listen to server
     */
    app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
  })
  .catch((err) => console.log(err || "Server Down"));
