const { provider } = require('mongocat');
const { Schema, model } = require('mongoose');
const slugify = require('mongoose-simple-slugify');

const modelSchema = new Schema(
  {
    title: String,
    // slug generated for the post
    slug: {
      source: 'title', // source for generating the slug
      type: String,
      unique: true,
    },
    avatar: String,
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
    toRef: 'Tag',
  }),
);

module.exports = model('Tag', modelSchema);
