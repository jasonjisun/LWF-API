const Availability = require('../models/availabilityModel');

exports.setAvailability = async (req, res) => {
  try {
    // Extract doctorId from URL parameters
    const doctorId = req.params.doctorId;
    const { date, timeSlots } = req.body;

    // Check if the required fields are present
    if (!doctorId || !date || !Array.isArray(timeSlots)) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Find the doctor's availability for the specified date
    const availability = await Availability.findOne({ doctor: doctorId, date });

    if (availability) {
      // Merge and remove duplicates in timeSlots
      const updatedSlots = Array.from(new Set([...availability.timeSlots, ...timeSlots]));
      availability.timeSlots = updatedSlots;
      await availability.save();
    } else {
      // Create a new availability record if none exists
      await Availability.create({ doctor: doctorId, date, timeSlots });
    }

    res.status(200).json({ message: "Availability set successfully." });
  } catch (error) {
    console.error("Error setting availability:", error);
    res.status(500).json({ message: "Error setting availability." });
  }
};
  
