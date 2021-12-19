class MongoCrud {
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
    return await new this.Model(params).save();
  }
  async update(keys, params) {
    const updated = await this.Model.findOneAndUpdate(key, {
      $set: params,
    });
    return {
      ...updated._doc,
      ...params,
    };
  }
  async deleteOne(key) {
    return await this.Model.findOneAndDelete(key);
  }
  async delete(keys) {
    return await this.Model.findAndDelete(keys);
  }
}

module.exports = MongoCrud;
