const Availability = require('../models/availabilityModel');

// SET Availability (No changes needed)
exports.setAvailability = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { date, timeSlots } = req.body;

    if (!doctorId || !date || !Array.isArray(timeSlots)) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const normalizedDate = new Date(date).toISOString().split("T")[0];
    const normalizedSlots = timeSlots.map(slot => slot.trim());

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

// DELETE a specific time slot
exports.deleteAvailability = async (req, res) => {
  try {
    const doctorId = req.user._id; // Logged-in user's doctorId
    const { availabilityId } = req.params; // availabilityId from URL
    const { date, timeSlots } = req.body;  // Date and timeSlot from body

    // Ensure both date and timeSlot are provided
    if (!date || !timeSlots) {
      return res.status(400).json({ message: "date and timeSlot are required." });
    }

    // Normalize date to ISO format
    const normalizedDate = new Date(date).toISOString().split("T")[0];

    // Find the availability by ID
    const availability = await Availability.findById(availabilityId);

    // If availability not found, return an error
    if (!availability) {
      return res.status(404).json({ message: "Availability not found." });
    }

    // Check if the logged-in user is either the doctor who owns this availability or an admin
    if (availability.doctor.toString() !== doctorId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: "You are not authorized to delete this availability." });
    }

    // If doctor, ensure the availability is for their own date (if needed)
    if (availability.doctor.toString() === doctorId.toString()) {
      // Remove the specific timeSlot from the availability
      const updatedAvailability = await Availability.findByIdAndUpdate(
        availabilityId,
        { $pull: { timeSlots: timeSlots } },
        { new: true }
      );

      // Check if after removal, the timeSlots array is empty and delete the availability if necessary
      if (updatedAvailability.timeSlots.length === 0) {
        await Availability.findByIdAndDelete(availabilityId);
        return res.status(200).json({
          message: "Availability deleted successfully.",
        });
      }

      return res.status(200).json({
        message: "Time slot deleted successfully.",
        availability: updatedAvailability,
      });
    }

    // Admin can delete any availability
    if (req.user.role === 'admin') {
      const updatedAvailability = await Availability.findByIdAndUpdate(
        availabilityId,
        { $pull: { timeSlots: timeSlots } },
        { new: true }
      );

      // Check if after removal, the timeSlots array is empty and delete the availability if necessary
      if (updatedAvailability.timeSlots.length === 0) {
        await Availability.findByIdAndDelete(availabilityId);
        return res.status(200).json({
          message: "Availability deleted successfully.",
        });
      }

      return res.status(200).json({
        message: "Time slot deleted successfully.",
        availability: updatedAvailability,
      });
    }

    // If none of the conditions are met, return an unauthorized message
    return res.status(403).json({ message: "You are not authorized to perform this action." });

  } catch (error) {
    console.error("Error deleting availability:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// RESCHEDULE: replace all timeSlots for a date
exports.rescheduleAvailability = async (req, res) => {
  try {
    const doctorId = req.user._id; // Doctor's ID of the logged-in user (either admin or doctor)
    const { availabilityId } = req.params;
    const { date, timeSlots } = req.body;

    // Ensure date and timeSlots are provided in the request body
    if (!date || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({ message: "date and at least one timeSlot are required." });
    }

    // Normalize date to ISO format
    const normalizedDate = new Date(date).toISOString().split("T")[0];
    const cleanedSlots = timeSlots.map(slot => slot.trim());

    // Logging for debugging to check if the availabilityId is passed correctly
    console.log("Requested availabilityId: ", availabilityId);
    console.log("Logged-in User DoctorId: ", doctorId);
    console.log("New Date: ", normalizedDate);
    console.log("New Time Slots: ", cleanedSlots);

    // Find availability by the given availabilityId
    const availability = await Availability.findById(availabilityId);
    
    // If no availability found, return an error
    if (!availability) {
      return res.status(404).json({ message: "Availability not found." });
    }

    // Check if the logged-in user is either the doctor of the availability or an admin
    if (availability.doctor.toString() !== doctorId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: "You are not authorized to reschedule this availability." });
    }

    // Log the found availability for debugging
    console.log("Found Availability: ", availability);

    // Update the availability with the new date and time slots
    const updatedAvailability = await Availability.findByIdAndUpdate(
      availabilityId,
      { $set: { timeSlots: cleanedSlots, date: normalizedDate } },
      { new: true }
    );

    // Return success message and updated availability
    res.status(200).json({
      message: "Availability rescheduled successfully.",
      availability: updatedAvailability,
    });
  } catch (error) {
    console.error("Error in rescheduling availability:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
