const { connection } = require("../config/database");

module.exports = require(`./${connection}`);
