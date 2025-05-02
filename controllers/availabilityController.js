const Availability = require('../models/availabilityModel');
const Log = require('../models/logsModel');

// SET Availability (No changes needed)
exports.setAvailability = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { date, timeSlots } = req.body;

    // Check for missing required fields
    if (!doctorId || !date || !Array.isArray(timeSlots)) {
      // Log the missing required fields
      await Log.create({
        action: 'SET_AVAILABILITY_FAILED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Missing required fields for setting availability.',
        details: { date, timeSlots }
      });

      return res.status(400).json({ message: "Missing required fields." });
    }

    const normalizedDate = new Date(date).toISOString().split("T")[0];
    const normalizedSlots = timeSlots.map(slot => slot.trim());

    // Check if availability for the given doctor and date already exists
    let availability = await Availability.findOne({ doctor: doctorId, date: normalizedDate });

    if (availability) {
      const mergedSlots = Array.from(new Set([...availability.timeSlots, ...normalizedSlots]));
      availability.timeSlots = mergedSlots;
      await availability.save();

      // Log successful availability update
      await Log.create({
        action: 'AVAILABILITY_UPDATED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Availability updated successfully.',
        updatedSlots: mergedSlots,
      });
    } else {
      availability = await Availability.create({
        doctor: doctorId,
        date: normalizedDate,
        timeSlots: normalizedSlots,
      });

      // Log new availability creation
      await Log.create({
        action: 'AVAILABILITY_CREATED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'New availability set successfully.',
        createdSlots: normalizedSlots,
      });
    }

    return res.status(200).json({
      message: "Availability set successfully.",
      availability,
    });
  } catch (error) {
    console.error("Error setting availability:", error);

    // Log error during setting availability
    await Log.create({
      action: 'AVAILABILITY_SET_ERROR',
      email: req.user ? req.user.email : 'unknown',
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      doctorId: doctorId,
      message: 'Error setting availability.',
      error: error.message, // Include the error message for debugging
    });

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
      // Log missing fields error
      await Log.create({
        action: 'DELETE_AVAILABILITY_FAILED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Date and timeSlot are required.',
        details: { date, timeSlots },
      });

      return res.status(400).json({ message: "date and timeSlot are required." });
    }

    // Normalize date to ISO format
    const normalizedDate = new Date(date).toISOString().split("T")[0];

    // Find the availability by ID
    const availability = await Availability.findById(availabilityId);

    // If availability not found, return an error
    if (!availability) {
      // Log availability not found error
      await Log.create({
        action: 'DELETE_AVAILABILITY_FAILED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Availability not found.',
        availabilityId: availabilityId,
      });

      return res.status(404).json({ message: "Availability not found." });
    }

    // Check if the logged-in user is either the doctor who owns this availability or an admin
    if (availability.doctor.toString() !== doctorId.toString() && req.user.role !== 'admin') {
      // Log unauthorized access attempt
      await Log.create({
        action: 'DELETE_AVAILABILITY_FAILED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Unauthorized attempt to delete availability.',
        availabilityId: availabilityId,
      });

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

        // Log successful deletion
        await Log.create({
          action: 'AVAILABILITY_DELETED',
          email: req.user ? req.user.email : 'unknown',
          role: req.user ? req.user.role : 'unknown',
          ip: req.ip,
          endpoint: req.originalUrl,
          doctorId: doctorId,
          message: 'Availability deleted successfully.',
          availabilityId: availabilityId,
        });

        return res.status(200).json({
          message: "Availability deleted successfully.",
        });
      }

      // Log successful time slot deletion
      await Log.create({
        action: 'TIME_SLOT_DELETED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Time slot deleted successfully.',
        availabilityId: availabilityId,
        timeSlots: updatedAvailability.timeSlots,
      });

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

        // Log successful deletion by admin
        await Log.create({
          action: 'AVAILABILITY_DELETED',
          email: req.user ? req.user.email : 'unknown',
          role: req.user ? req.user.role : 'unknown',
          ip: req.ip,
          endpoint: req.originalUrl,
          doctorId: doctorId,
          message: 'Availability deleted by admin successfully.',
          availabilityId: availabilityId,
        });

        return res.status(200).json({
          message: "Availability deleted successfully.",
        });
      }

      // Log successful time slot deletion by admin
      await Log.create({
        action: 'TIME_SLOT_DELETED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Time slot deleted by admin successfully.',
        availabilityId: availabilityId,
        timeSlots: updatedAvailability.timeSlots,
      });

      return res.status(200).json({
        message: "Time slot deleted successfully.",
        availability: updatedAvailability,
      });
    }

    // If none of the conditions are met, return an unauthorized message
    return res.status(403).json({ message: "You are not authorized to perform this action." });

  } catch (error) {
    console.error("Error deleting availability:", error);

    // Log error during deletion
    await Log.create({
      action: 'AVAILABILITY_DELETE_ERROR',
      email: req.user ? req.user.email : 'unknown',
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      doctorId: doctorId,
      message: 'Error deleting availability.',
      error: error.message, // Include the error message for debugging
    });

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
      // Log missing fields error
      await Log.create({
        action: 'RESCHEDULE_AVAILABILITY_FAILED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Date and at least one timeSlot are required.',
        details: { date, timeSlots },
      });

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
      // Log availability not found error
      await Log.create({
        action: 'RESCHEDULE_AVAILABILITY_FAILED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Availability not found.',
        availabilityId: availabilityId,
      });

      return res.status(404).json({ message: "Availability not found." });
    }

    // Check if the logged-in user is either the doctor of the availability or an admin
    if (availability.doctor.toString() !== doctorId.toString() && req.user.role !== 'admin') {
      // Log unauthorized access attempt
      await Log.create({
        action: 'RESCHEDULE_AVAILABILITY_FAILED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId: doctorId,
        message: 'Unauthorized attempt to reschedule availability.',
        availabilityId: availabilityId,
      });

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

    // Log successful rescheduling
    await Log.create({
      action: 'AVAILABILITY_RESCHEDULED',
      email: req.user ? req.user.email : 'unknown',
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      doctorId: doctorId,
      message: 'Availability rescheduled successfully.',
      availabilityId: updatedAvailability._id,
      timeSlots: updatedAvailability.timeSlots,
      date: updatedAvailability.date,
    });

    // Return success message and updated availability
    res.status(200).json({
      message: "Availability rescheduled successfully.",
      availability: updatedAvailability,
    });
  } catch (error) {
    console.error("Error in rescheduling availability:", error);

    // Log error during rescheduling
    await Log.create({
      action: 'AVAILABILITY_RESCHEDULE_ERROR',
      email: req.user ? req.user.email : 'unknown',
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      doctorId: doctorId,
      message: 'Error in rescheduling availability.',
      error: error.message, // Include the error message for debugging
    });

    res.status(500).json({ message: "Internal server error." });
  }
};
