class MySQLCrud {
  constructor(model) {
    this.Model = model;
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
    return this.Model.findOneAndUpdate(keys, {
      $set: params,
    });
  }

  async deleteOne(key) {
    return this.Model.findOneAndDelete(key);
  }

  async delete(keys) {
    return this.Model.findAndDelete(keys);
  }
}

module.exports = MySQLCrud;
