/* eslint-disable class-methods-use-this */
const Category = require('../model/Category.model');

class CategoryService {
  async create(params) {
    return Category.create(params);
  }

  async findMany() {
    return Category.find({});
  }
}

module.exports = new CategoryService();
