/* eslint-disable class-methods-use-this */
const Test = require('../model/Test.model');

class TestService {
  async create(params) {
    return Test.create(params);
  }

  async getTests() {
    return Test.find({});
  }
}

module.exports = new TestService();
