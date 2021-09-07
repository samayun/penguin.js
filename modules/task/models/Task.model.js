const { Schema, model } = require("mongoose");

const modelSchema = new Schema({
  title: {
    type: String,
    require: true,
  },
  slug: {
    type: String,
    require: true,
  },
});

module.exports = model("Task", modelSchema);
