const { provider } = require('mongocat');
const { Schema, model } = require('mongoose');
const slugify = require('mongoose-simple-slugify');

const modelSchema = new Schema(
  {
    name: String,
    // slug generated for the post
    slug: {
      source: 'title', // source for generating the slug
      type: String,
      unique: true,
    },
    email: String,
    role: {
      type: String,
      default: 'user',
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

modelSchema.plugin(slugify);
modelSchema.plugin(
  provider({
    toRef: 'User',
  }),
);

module.exports = model('User', modelSchema);
