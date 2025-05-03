const Availability = require('../models/availabilityModel');
const DoctorProfile = require('../models/doctorProfileModel');
const Log = require('../models/logsModel');

// SET Availability (Improved: Prevent duplicate time slots)
exports.setAvailability = async (req, res) => {
  const doctorId = req.user?._id;
  const { date, timeSlots, status = "available" } = req.body;

  try {
    if (!doctorId || !date || !Array.isArray(timeSlots)) {
      await Log.create({
        action: "SET_AVAILABILITY_FAILED",
        email: req.user?.email || "unknown",
        role: req.user?.role || "unknown",
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId,
        message: "Missing required fields for setting availability.",
        details: { date, timeSlots },
      });
      return res.status(400).json({ message: "Missing required fields." });
    }

    const normalizedDate = new Date(date).toISOString().split("T")[0];

    // Normalize and deduplicate time slots
    const normalizedSlots = [...new Set(timeSlots.map(slot => slot.trim().toLowerCase()))];

    let availability = await Availability.findOne({
      doctor: doctorId,
      date: normalizedDate,
    });

    if (availability) {
      if (status === "unavailable") {
        availability.timeSlots = normalizedSlots;
        availability.status = "unavailable";
      } else {
        const existingSlots = availability.timeSlots.map(slot => slot.trim().toLowerCase());
        const mergedSlots = [...new Set([...existingSlots, ...normalizedSlots])];
        availability.timeSlots = mergedSlots;
        availability.status = "available";
      }

      await availability.save();

      await Log.create({
        action: "AVAILABILITY_UPDATED",
        email: req.user?.email || "unknown",
        role: req.user?.role || "unknown",
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId,
        message: "Availability updated successfully.",
        updatedSlots: availability.timeSlots,
        status: availability.status,
      });
    } else {
      availability = await Availability.create({
        doctor: doctorId,
        date: normalizedDate,
        timeSlots: normalizedSlots,
        status,
      });

      await Log.create({
        action: "AVAILABILITY_CREATED",
        email: req.user?.email || "unknown",
        role: req.user?.role || "unknown",
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId,
        message: "New availability set successfully.",
        createdSlots: normalizedSlots,
        status,
      });
    }

    return res.status(200).json({
      message: "Availability set successfully.",
      availability,
    });
  } catch (error) {
    console.error("Error setting availability:", error);

    await Log.create({
      action: "AVAILABILITY_SET_ERROR",
      email: req.user?.email || "unknown",
      role: req.user?.role || "unknown",
      ip: req.ip,
      endpoint: req.originalUrl,
      doctorId,
      message: "Error setting availability.",
      error: error.message,
    });

    return res.status(500).json({ message: "Internal server error." });
  }
};


exports.updateAvailabilityStatus = async (req, res) => {
  try {
    const { id } = req.params; // The availability ID
    const status = req.params.status; // The status (either "available" or "unavailable")

    // Validate that the status is either "available" or "unavailable"
    if (!["available", "unavailable"].includes(status)) {
      return res.status(400).json({ message: "Invalid status provided." });
    }

    // Find the availability entry by ID and update the status
    const updated = await Availability.findByIdAndUpdate(
      id, // availability ID from the URL
      { status }, // set the status to the given value
      { new: true } // return the updated document
    );

    // If the availability entry does not exist, return a 404 error
    if (!updated) {
      return res.status(404).json({ message: "Availability not found." });
    }

    // Send the updated availability back as the response
    res.json({ success: true, availability: updated });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// DELETE a specific time slot
exports.deleteAvailability = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { availabilityId } = req.params;

    // Find the availability by ID
    const availability = await Availability.findById(availabilityId);

    if (!availability) {
      await Log.create({
        action: 'DELETE_AVAILABILITY_FAILED',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId,
        message: 'Availability not found.',
        availabilityId,
      });

      return res.status(404).json({ message: "Availability not found." });
    }

    // Check permissions: doctor owns it or admin
    if (availability.doctor.toString() !== doctorId.toString() && req.user.role !== 'admin') {
      await Log.create({
        action: 'DELETE_AVAILABILITY_FAILED',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        doctorId,
        message: 'Unauthorized delete attempt.',
        availabilityId,
      });

      return res.status(403).json({ message: "You are not authorized to delete this availability." });
    }

    // Delete the entire availability
    await Availability.findByIdAndDelete(availabilityId);

    await Log.create({
      action: 'AVAILABILITY_DELETED',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      doctorId,
      message: 'Availability deleted successfully.',
      availabilityId,
    });

    return res.status(200).json({
      message: "Availability deleted successfully.",
    });

  } catch (error) {
    console.error("Error deleting availability:", error);

    await Log.create({
      action: 'AVAILABILITY_DELETE_ERROR',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      doctorId,
      message: 'Error deleting availability.',
      error: error.message,
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

exports.getMyAvailabilitySchedule = async (req, res) => {
  try {
    // Ensure the user is a doctor
    if (req.user.role !== "doctor") {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    // Get the doctor's profile
    const doctorProfile = await DoctorProfile.findOne({ doctor: req.user._id }).select("fullName specialization");

    if (!doctorProfile) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    // Get all availabilities (available and unavailable)
    const allAvailabilities = await Availability.find({ doctor: req.user._id }).sort({ date: 1 });

    // Separate by status (optional, but useful for frontend clarity)
    const available = allAvailabilities.filter(a => a.status === "available");
    const unavailable = allAvailabilities.filter(a => a.status === "unavailable");

    // Build response
    res.status(200).json({
      success: true,
      doctor: {
        id: req.user._id,
        email: req.user.email,
        fullName: doctorProfile.fullName,
        specialization: doctorProfile.specialization,
      },
      availability: {
        available,
        unavailable,
      },
    });
  } catch (error) {
    console.error("Error fetching your availability:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};