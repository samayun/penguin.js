const { connection } = require("../../config/database");

class CrudService extends require(`./crud/${connection}`) {
  constructor(model) {
    super(model);
  }
}

module.exports = CrudService;
