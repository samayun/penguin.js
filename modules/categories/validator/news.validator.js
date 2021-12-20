exports.createNewsValidator = async (req, res, next) => {
  const { title, published, draft } = req.body;

  if (!title) return next(new Error("Title is required 😢"));

  if (published === undefined)
    return next(new Error("Published is required 😢"));

  if (draft === undefined) {
    return next(new Error("Draft is required 😢"));
  }
  next();
};
