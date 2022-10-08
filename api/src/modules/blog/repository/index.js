/* eslint-disable class-methods-use-this */
const Blog = require('../../../models/Blog');

class BlogService {
  constructor(Model) {
    this.Model = Model;
  }

  async create(params) {
    const tag = new this.Model(params);
    return tag.save();
  }

  async findMany() {
    return this.Model.find({}).sort('-createdAt');
  }

  async update(id, params) {
    const tag = await this.Model.findById(id);
    tag.title = params.title;
    tag.avatar = params.avatar;
    return tag.save();
  }

  async delete(id) {
    return this.Model.findByIdAndDelete(id);
  }

  async deleteBulk() {
    return this.Model.deleteMany({});
  }
}

module.exports = new BlogService(Blog);
