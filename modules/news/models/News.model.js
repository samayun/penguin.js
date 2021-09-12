const { model, Schema } = require("mongoose");
const crypto = require("crypto");

const newsSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    draft: {
      type: Boolean,
      default: true,
    },
    slug: {
      source: "title",
      type: String,
      slugPaddingSize: 2,
    },
    published: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

function generateSlug(source) {
  let tempSlug = source
    .toString() // make sure the operand is a string
    .toLowerCase() // normalize the string
    .trim() // trim white spaces in the beginning and ending of the string
    .replace(/\s/g, "-") // replace all spaces with a dash
    .replace(/[&/\\#,+()$~%.'":*?''`!<>{};=@^_|।[\]]/g, "-") // replace all special characters
    .replace(/-+/g, "-"); // replace any repeated dashes

  let slug;
  // remove first and last hyphen (-) from slug
  if (tempSlug.slice(-1) === "-" && tempSlug.charAt(0) === "-") {
    slug = tempSlug.slice(1, -1);
  } else if (tempSlug.slice(-1) === "-") {
    slug = tempSlug.substring(0, tempSlug.length - 1);
  } else if (tempSlug.charAt(0) === "-") {
    slug = tempSlug.slice(1);
  } else {
    slug = tempSlug;
  }
  return slug;
}
newsSchema.pre("save", async function () {
  let tempSlug = null;
  let slug = generateSlug(this[newsSchema.tree.slug.source]);

  // onCreate
  if (this.isNew) {
    if (this.published === true) {
      // generate new unique slug onCreate
      tempSlug = (await this.model(this.constructor.modelName).exists({ slug }))
        ? `${slug}-${crypto.randomBytes(5).toString("hex")}`
        : slug;

      this.draft = false;
    } else {
      // this.draft = true;
      tempSlug = null;
    }
  }
  this.slug = tempSlug;
});

module.exports = model("News", newsSchema);
