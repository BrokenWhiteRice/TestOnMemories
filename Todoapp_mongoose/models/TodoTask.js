const mongoose = require("mongoose");

const todoTaskSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  profimg: {
    type: String,
  },
  mainimg: {
    type: String,
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
});

module.exports = mongoose.model("TodoTask", todoTaskSchema);

// https://medium.com/@diogo.fg.pinheiro/simple-to-do-list-app-with-node-js-and-mongodb-chapter-2-3780a1c5b039
