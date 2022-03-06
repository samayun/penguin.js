const { Schema, model } = require('mongoose');

const modelSchema = new Schema(
  {
    title: {
      type: String,
      require: true,
    },
  },
  { timestamps: true },
);

module.exports = model('Test', modelSchema);
