const { watchConsumer } = require('mongocat');
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
    category: new Schema({
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
      title: String,
      slug: String,
      avatar: String,
      status: Boolean,
    }),
    tags: [
      new Schema({
        _id: {
          type: Schema.Types.ObjectId,
          ref: 'Tag',
        },
        title: String,
        slug: String,
      }),
    ],
    status: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

modelSchema.plugin(slugify);
modelSchema.plugin(
  watchConsumer({
    key: '_id',
    toPath: 'category',
    strict: true,
    fromref: 'Category',
    toRef: 'Blog',
  }),
);

modelSchema.plugin(
  watchConsumer({
    key: '_id',
    toPath: 'tags',
    inArray: true,
    strict: true,
    fromref: 'Tag',
    toRef: 'Blog',
  }),
);

module.exports = model('Blog', modelSchema);
