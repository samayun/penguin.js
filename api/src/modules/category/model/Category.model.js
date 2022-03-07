const { Schema, model } = require('mongoose');

exports.categorySchema = new Schema(
  {
    title: {
      type: String,
      require: true,
    },
    description: String,
  },
  { timestamps: true },
);

module.exports = model('Category', this.categorySchema);
