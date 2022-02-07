class MongoCrud {
  constructor(Model) {
    this.Model = Model;
  }
  async getAll() {
    return this.Model.find({});
  }
  async getOne(params) {
    return this.Model.findOne(params);
  }
  async create(params) {
    return new this.Model(params).save();
  }
  async update(keys, params) {
    const updated = await this.Model.findOneAndUpdate(
      key,
      {
        $set: params
      },
      {
        new: true
      }
    );
    return {
      ...updated._doc,
      ...params
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
