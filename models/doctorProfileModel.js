const mongoose = require("mongoose");

const doctorProfileSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  specialization: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: false,
  },
}, { timestamps: true });

module.exports = mongoose.model("DoctorProfile", doctorProfileSchema);
