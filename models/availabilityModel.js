const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    availableSlots: [
      {
        type: Date,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Availability", availabilitySchema);
