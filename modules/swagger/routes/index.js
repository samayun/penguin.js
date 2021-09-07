const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// const swaggerDocument = require("../dto/swagger.json");

// Extended: https://swagger.io/specification/#infoObject
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Penguin.js API",
    version: "1.0.0",
    description: "Penguin API Information",
    contact: {
      name: "Samayun Chowdhury",
      url: "https://www.linkedin.com/in/samayun-miah-chowdhury",
    },
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT}`,
      description: "Development server",
    },
  ],
};

const options = {
  swaggerDefinition,
  // Paths to files containing OpenAPI definitions
  apis: ["./routes/*.js"],
  explorer: true,
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = (routes) => {
  routes.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  routes.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
