const { Schema, model } = require("mongoose");

const modelSchema = new Schema({
  title: {
    type: String,
    required: [true, "A News must have a title"],
    trim: true,
    // minlength: [10, 'A News Title must have more or equal than 10 characters'],
  },
  slug: {
    source: "title",
    type: String,
    slugPaddingSize: 2,
    // unique: true,
  },
  published: {
    type: Boolean,
    default: false,
  },
  draft: {
    type: Boolean,
    default: true,
  },
});
async function generateSlug(source) {
  console.log({ source });
  let tempSlug = source
    .toString() // make sure the operand is a string
    .toLowerCase() // normalize the string
    .trim() // trim white spaces in the beginning and ending of the string
    .replace(/\s/g, "-") // replace all spaces with a dash
    .replace(/[&/\\#,+()$~%.‘’'":*?''`!<>{};=@^_|।[\]]/g, "-") // replace all special characters
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
  // return (await modelSchema.model(this.constructor.modelName).exists({ slug }))
  //   ? `${slug}-${crypto.randomBytes(5).toString("hex")}`
  //   : slug;
  return slug;
}

modelSchema.pre("save", async (next) => {
  console.log(await NewsSchema.model(NewsSchema.constructor.modelName).find());
  console.log(this.title);
  if (this.isNew) {
    console.log(`TITLE => `, this.title);
    if (this.published === true) {
      this.draft = null;
      this.slug = generateSlug(this.title);
    } else {
      this.draft = true;
      this.slug = null;
    }
  } else {
    if (!this.slug) {
      this.slug = generateSlug(this.title);
    } else {
      // this.slug = this.slug;
    }
  }
  // next();
});
const NewsSchema = model("News", modelSchema);
module.exports = NewsSchema;
