const mongoose = require("mongoose");

const todoTaskSchema = new mongoose.Schema({
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
    data: Buffer, // Store image data
    contentType: String, // Store image content type
    filename: String, // Store filename
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
});

module.exports = mongoose.model("TodoTask", todoTaskSchema);
