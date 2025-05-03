const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: { type: String, required: true },
  timeSlots: [{ type: String }],
  status: {
    type: String,
    enum: ["available", "unavailable"],
    default: "available",
  },
});

module.exports = mongoose.model("Availability", availabilitySchema);
