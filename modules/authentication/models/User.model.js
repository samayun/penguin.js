const { Schema, model } = require("mongoose");

const modelSchema = new Schema(
  {
    name: {
      type: String,
      require: true,
    },
    email: {
      type: String,
      require: true,
    },

    password: {
      type: String,
      require: true,
    },
  },
  { timestamps: true }
);

modelSchema.methods.toJSON = function () {
  var obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = model("User", modelSchema);
