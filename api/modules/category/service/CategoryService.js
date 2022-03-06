/* eslint-disable class-methods-use-this */
const Category = require('../model/Category.model');

class CategoryService {
  Model = Category;
  async create(params) {
    return this.Model.create(params);
  }

  async findMany() {
    return this.Model.find({});
  }
}

module.exports = new CategoryService();
