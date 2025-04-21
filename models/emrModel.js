const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  frequency: { type: String, required: true },
});

const emrSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  name: String,
  dob: Date,
  age: Number,
  gender: String,
  bloodType: String,
  contact: String,
  email: String,
  address: String,
  allergies: [String],
  conditions: [String],
  medications: [medicationSchema],
  visitHistory: [
    {
      date: Date,
      reason: String,
      notes: String,
    },
  ],
});

module.exports = mongoose.model("EMR", emrSchema);
