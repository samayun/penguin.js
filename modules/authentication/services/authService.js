const { BCrypt } = require("jwt-auth-helper");
// manual import
const User = require("../models/User.model");

class AuthService {
  async register(params) {
    const { name, email, password } = params;
    // check is user already exist
    const existingUser = await User.findOne({ email });
    // if user not found show error
    if (existingUser) {
      throw new Error("User already exists, please login now 😢");
    }
    // hash password
    const hashedPassword = await BCrypt.makeHash(password);
    // save on database
    const credentials = {
      name,
      email,
      password: hashedPassword,
    };
    // back user details
    return await User.create(credentials);
  }
  async login({ email, password }) {
    // find User - query from database
    const existingUser = await User.findOne({ email });
    // if user not found show error
    if (!existingUser) {
      throw new Error("There has no found user with this credential 😢");
    }
    // compare password
    const isMatch = await BCrypt.compareHash(password, existingUser.password);
    // if password doesn't match show incorrect error
    if (!isMatch) {
      throw new Error("Password is incorrect 😢");
    }
    // back
    delete existingUser.password;
    return existingUser;
  }
  async profile(email) {
    return await User.findOne({ email });
  }
  async getUsers() {
    return await User.find({});
  }
}

module.exports = new AuthService();
