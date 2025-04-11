const mongoose = require("mongoose");

const emrSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  name: String,
  dob: String,
  age: Number,
  gender: String,
  bloodType: String,
  contact: String,
  email: String,
  address: String,
  allergies: [String],
  conditions: [String],
  medications: [
    {
      name: String,
      frequency: String,
    },
  ],
  visitHistory: [
    {
      date: String,
      reason: String,
      doctor: String,
    },
  ],
});

module.exports = mongoose.model("EMR", emrSchema);