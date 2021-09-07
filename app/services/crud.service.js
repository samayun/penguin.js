class CrudService {
  constructor(model) {
    this.Model = model;
  }
  async getAll() {
    return await this.Model.find({});
  }
  async getOne(params) {
    return await this.Model.findOne(params);
  }
  async create(params) {
    let data = new this.Model(params);
    return data.save();
  }
  async update(keys, params) {
    return await this.Model.findOneAndUpdate(keys, {
      $set: params,
    });
  }
  async deleteOne(keys) {
    return await this.Model.findOneAndDelete(keys);
  }
}
module.exports = CrudService;
