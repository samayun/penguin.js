const { Denormalize } = require('denormalize-mongoose');
const { Schema, model } = require('mongoose');

const modelSchema = new Schema(
  {
    title: {
      type: String,
      require: true,
    },
    category: {
      type: Denormalize,
      of: Schema.Types.ObjectId,
      suffix: 'SomeEnding',
      paths: ['title'],
      ref: 'Category',
    },
  },
  { timestamps: true },
);

// modelSchema.plugin(denormalizePlugin);

module.exports = model('Test', modelSchema);
