const CrudService = require("../../../app/services/crud.service");

class NewsService extends CrudService {
  constructor(model) {
    super(model);
  }
}
module.exports = (model) => new NewsService(model);
