/* eslint-disable class-methods-use-this */
const Provider = require('../../../models/Provider.model');

class ProviderService {
  async create(params) {
    const provider = new Provider(params);
    return provider.save();
  }

  async findMany() {
    return Provider.find({}).sort({ createdAt: -1 });
  }

  async update(id, params) {
    return Provider.findByIdAndUpdate(id, params, { new: true });
  }

  async delete(id) {
    return Provider.findByIdAndDelete(id);
  }

  async deleteBulk() {
    return Provider.deleteMany({});
  }
}

module.exports = new ProviderService();
