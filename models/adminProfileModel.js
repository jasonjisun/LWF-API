const mongoose = require("mongoose");

const adminProfileSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
  },
  contactNumber: {
    type: String,
    required: true,
    match: [/^\+?\d{7,15}$/, "Please use a valid contact number"],
  },
});

module.exports = mongoose.model("AdminProfile", adminProfileSchema);
