// models/logsModel.js
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  action: { type: String, required: true },
  role: { type: String, required: true },
  email: { type: String, required: true },
  ip: { type: String },
  endpoint: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema);
