const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: { type: String, required: true },
  timeSlots: [{ type: String }],
});


module.exports = mongoose.model("Availability", availabilitySchema);
