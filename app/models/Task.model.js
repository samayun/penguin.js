const { Schema, model } = require("mongoose");

const modelSchema = new Schema(
  {
    title: {
      type: String,
      require: true,
    },
    slug: {
      type: String,
      require: true,
    },
    title: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = model("Test", modelSchema);
