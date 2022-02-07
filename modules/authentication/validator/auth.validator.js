exports.registerValidator = async (req, res, next) => {
  const { name, username, phone, email, password, confirmPassword } = req.body;
  if (!name) return next(new Error('Name is required'));
  // if (!username) return next(new Error('username is required'));
  // if (!phone) return next(new Error('phone is required'));
  if (!email) return next(new Error('email is required'));

  if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/gi.test(email)) {
    return next(new Error('You must use valid email '));
  }

  if (!password) return next(new Error('password is required'));

  if (password.length < 6) {
    return next(new Error('Password must be at least 6 character'));
  }
  // if (password !== confirmPassword) return next(new Error('password doesn\'t match'));
  next();
};

exports.loginValidator = async (req, res, next) => {
  const { email, password, confirmPassword } = req.body;

  if (!email) return next(new Error('email is required 😢'));

  if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/gi.test(email)) {
    return next(new Error('You must use valid email 😢'));
  }
  if (!password) return next(new Error('password is required 😢'));

  if (password.length < 6) {
    return next(new Error('Password must be at least 6 character 😢'));
  }
  // if (password !== confirmPassword) return next(new Error('password doesn\'t match'));
  next();
};
