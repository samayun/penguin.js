const { Schema, model } = require('mongoose');

const modelSchema = new Schema(
  {
    title: {
      type: String,
      require: true,
    },
    description: String,
  },
  { timestamps: true },
);

module.exports = model('Consumer', modelSchema);
