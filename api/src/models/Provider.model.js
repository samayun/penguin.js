const { Schema, model } = require('mongoose');
const { provider } = require('./plugin/RestQL');

const modelSchema = new Schema(
  {
    providerTitle: String,
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
  },
  { timestamps: true },
).plugin(provider());

module.exports = model('Provider', modelSchema);
