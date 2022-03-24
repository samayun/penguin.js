const { Schema, model } = require('mongoose');
const { consumer } = require('./plugin/RestQL');

const authNestedSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
  },
  providerTitle: String,
  pTitle: String,
  auth: {
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
  },

  copyName: {
    type: String,
    trim: true,
  },
  copyPhone: {
    type: String,
    trim: true,
  },
}).plugin(
  consumer({
    toPath: 'provider',
    key: '_id',
    fromRef: 'Provider',
    as: {
      copyName: 'auth.name',
      copyPhone: 'auth.phone',
      pTitle: 'providerTitle',
    },
    withTimestamp: true,
    consumerModel: 'Consumer',
  }),
);

const modelSchema = new Schema(
  {
    consumerTitle: String,
    provider: authNestedSchema,
  },
  { timestamps: true },
);

module.exports = model('Consumer', modelSchema);
