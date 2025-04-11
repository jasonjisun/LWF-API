const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    timeSlot: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "rejected", "cancelled"],
      default: "pending",
    },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
