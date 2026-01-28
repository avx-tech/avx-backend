const mongoose = require("mongoose");

const demoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  business: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  requirement: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("DemoRequest", demoSchema);
