const Availability = require('../models/availabilityModel');

exports.setAvailability = async (req, res) => {
  try {
    const doctorId = req.user._id; // ✅ Extracted from the logged-in user
    const { date, timeSlots } = req.body;

    // Validate inputs
    if (!doctorId || !date || !Array.isArray(timeSlots)) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Normalize date format (since it's a string in your schema)
    const normalizedDate = new Date(date).toISOString().split("T")[0];

    // Clean time slots
    const normalizedSlots = timeSlots.map(slot => slot.trim());

    // Look for existing availability
    let availability = await Availability.findOne({ doctor: doctorId, date: normalizedDate });

    if (availability) {
      const mergedSlots = Array.from(new Set([...availability.timeSlots, ...normalizedSlots]));
      availability.timeSlots = mergedSlots;
      await availability.save();
    } else {
      availability = await Availability.create({
        doctor: doctorId,
        date: normalizedDate,
        timeSlots: normalizedSlots,
      });
    }

    return res.status(200).json({
      message: "Availability set successfully.",
      availability,
    });
  } catch (error) {
    console.error("Error setting availability:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
