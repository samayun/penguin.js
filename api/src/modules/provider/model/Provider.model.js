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
      paths: ['title', 'description'],
      ref: 'Category',
      // suffix: "Denormalize", if we give a suffix, it will be added to the end of the field name eg: categoryDenormalize
    },
    categoryData: {
      _id: Schema.Types.ObjectId,
      title: String,
      description: String,
    },
  },
  { timestamps: true },
);

module.exports = model('Provider', modelSchema);
