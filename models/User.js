const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  avatarUrl: {
    type: String,
  },
  email: {
    type: String,
    unique: true, // Ensure email uniqueness
  },
  password: String,
  avatar: String,
});

module.exports = mongoose.model("User", userSchema);
