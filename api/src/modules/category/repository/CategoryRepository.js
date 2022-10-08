/* eslint-disable class-methods-use-this */
const Category = require('../../../models/Category');

class CategoryService {
  constructor(Model) {
    this.Model = Model;
  }

  async create(params) {
    const category = new this.Model(params);
    return category.save();
  }

  async findMany() {
    return this.Model.find({}).sort('-createdAt');
  }

  async update(id, params) {
    const category = await this.Model.findById(id);
    category.title = params.title;
    category.avatar = params.avatar;
    return category.save();
  }

  async delete(id) {
    return this.Model.findByIdAndDelete(id);
  }

  async deleteBulk() {
    return this.Model.deleteMany({});
  }
}

module.exports = new CategoryService(Category);
