const CrudService = require("../../../app/services/crud.service");

class TaskService extends CrudService {
  constructor(model) {
    super(model);
  }
}
module.exports = (model) => new TaskService(model);
