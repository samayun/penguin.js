const { Schema, model } = require('mongoose');
const { consumer } = require('../../../models/plugin/RestQL');

const providerSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
  },
  providerTitle: String,
}).plugin(
  consumer({
    toPath: 'parent',
    key: '_id',
    fromRef: 'Provider',
    withTimestamp: true,
    consumerModel: 'Category',
  }),
);

exports.categorySchema = new Schema(
  {
    title: {
      type: String,
      require: true,
    },
    description: String,
    parent: providerSchema,
  },
  { timestamps: true },
);

module.exports = model('Category', this.categorySchema);
