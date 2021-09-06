const News = require("../models/News.model");

class NewsService {
  async findAll() {
    return await News.find({});
  }
}
module.exports = new NewsService();
