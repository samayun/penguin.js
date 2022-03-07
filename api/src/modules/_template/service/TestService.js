/* eslint-disable class-methods-use-this */
const Test = require('../model/Test.model');

class TestService {
  async create(params) {
    const test = new Test(params);
    return test.save();
  }

  async findMany() {
    return Test.find({}).sort({ createdAt: -1 });
  }

  async update(id, params) {
    return Test.findByIdAndUpdate(id, params, { new: true });
  }

  async delete(id) {
    return Test.findByIdAndDelete(id);
  }

  async deleteBulk() {
    return Test.deleteMany({});
  }
}

module.exports = new TestService();
