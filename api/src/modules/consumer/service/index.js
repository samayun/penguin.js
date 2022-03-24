/* eslint-disable class-methods-use-this */
const Consumer = require('../../../models/Consumer.model');

class ConsumerService {
  async create(params) {
    const consumer = new Consumer(params);
    return consumer.save();
  }

  async findMany() {
    return Consumer.find({}).sort('-createdAt');
  }

  async update(id, params) {
    const consumer = await Consumer.findById(id);
    consumer.title = params.title;
    consumer.description = params.description;
    return consumer.save();
  }

  async delete(id) {
    return Consumer.findByIdAndDelete(id);
  }

  async deleteBulk() {
    return Consumer.deleteMany({});
  }
}

module.exports = new ConsumerService();
