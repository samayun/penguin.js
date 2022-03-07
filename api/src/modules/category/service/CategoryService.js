/* eslint-disable class-methods-use-this */
const Category = require('../model/Category.model');

class CategoryService {
  async create(params) {
    const category = new Category(params);
    return category.save();
  }

  async findMany() {
    return Category.find({}).sort('-createdAt');
  }

  async update(id, params) {
    const category = await Category.findById(id);
    category.title = params.title;
    category.description = params.description;
    return category.save();
  }

  async delete(id) {
    return Category.findByIdAndDelete(id);
  }

  async deleteBulk() {
    return Category.deleteMany({});
  }
}

module.exports = new CategoryService();
