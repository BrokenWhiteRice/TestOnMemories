const mongoose = require("mongoose");

const todoTaskSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  userIdentifier: {
    type: String,
  },
  name: {
    type: String,
  },
  profimg: {
    type: String,
  },
  mainimg: {
    contentType: String,
    filename: String,
  },
  location: {
    type: String,
  },
  caption: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  deleted: {
    type: Boolean,
    default: false,
  },
  avatar: {
    data: Buffer,
    contentType: String,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("TodoTask", todoTaskSchema);
