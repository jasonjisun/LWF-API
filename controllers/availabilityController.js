const Availability = require('../models/availabilityModel');

exports.setAvailability = async (req, res) => {
    try {
      const { date, timeSlots } = req.body;
      const doctor = req.user.role === 'doctor' ? req.user._id : req.body.doctor;
  
      if (!doctor || !date || !Array.isArray(timeSlots)) {
        return res.status(400).json({ message: "Missing required fields." });
      }
  
      const availability = await Availability.findOne({ doctor, date });
  
      if (availability) {
        // Merge and remove duplicates
        const updatedSlots = Array.from(new Set([...availability.timeSlots, ...timeSlots]));
        availability.timeSlots = updatedSlots;
        await availability.save();
      } else {
        await Availability.create({ doctor, date, timeSlots });
      }
  
      res.status(200).json({ message: "Availability set successfully." });
    } catch (error) {
      console.error("Error setting availability:", error);
      res.status(500).json({ message: "Error setting availability." });
    }
  };
  
