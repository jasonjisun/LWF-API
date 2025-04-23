const Appointment = require('../models/appointmentModel');
const Availability = require('../models/availabilityModel');
const DoctorProfile = require("../models/doctorProfileModel");

// Dashboard data for doctor
exports.getDoctorDashboardData = async (req, res) => {
  try {
    const today = new Date();
    const todayAppointments = await Appointment.countDocuments({
      doctor: req.user._id, // Use doctor field (not doctorId)
      scheduledDateTime: { $gte: today },
    });

    const sessionsToday = await Appointment.countDocuments({
      doctor: req.user._id, // Use doctor field (not doctorId)
      sessionDate: { $gte: today },
    });

    res.json({ todayAppointments, sessionsToday });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching doctor dashboard data' });
  }
};

// Get all appointments for logged-in doctor
exports.getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ doctor: req.user._id }).sort({ scheduledDateTime: 1 }); // Use doctor field (not doctorId)
    res.status(200).json({ appointments });
  } catch (error) {
    console.error("Error fetching doctor appointments:", error);
    res.status(500).json({ message: "Error fetching doctor appointments." });
  }
};

// Doctor reschedules an appointment (goes back to pending)
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId, newScheduledDateTime } = req.body;
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) return res.status(404).json({ message: "Appointment not found." });

    const dateOnly = new Date(newScheduledDateTime).toISOString().split("T")[0];
    const timeOnly = new Date(newScheduledDateTime).toTimeString().slice(0, 5);

    const availability = await Availability.findOne({ doctor: appointment.doctor, date: dateOnly });

    if (!availability || !availability.timeSlots.includes(timeOnly)) {
      return res.status(400).json({ message: "Doctor not available at that time." });
    }

    const conflict = await Appointment.findOne({
      doctor: appointment.doctor,
      scheduledDateTime: newScheduledDateTime,
      status: { $ne: "canceled" },
      _id: { $ne: appointmentId },
    });

    if (conflict) {
      return res.status(400).json({ message: "Time slot already booked." });
    }

    appointment.scheduledDateTime = newScheduledDateTime;
    appointment.timeSlot = timeOnly;
    appointment.status = req.user.role === "admin" ? "confirmed" : "pending";
    await appointment.save();

    // remove old slot, add new if needed
    availability.timeSlots = availability.timeSlots.filter(slot => slot !== timeOnly);
    await availability.save();

    res.status(200).json({ message: "Appointment rescheduled.", appointment });
  } catch (error) {
    console.error("Reschedule error:", error);
    res.status(500).json({ message: "Error rescheduling appointment." });
  }
};

exports.getDoctorProfile = async (req, res) => {
  try {
    const doctorId = req.user.userId;

    const profile = await DoctorProfile.findOne({ doctor: doctorId });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    res.status(200).json({
      success: true,
      profile: {
        fullName: profile.fullName,
        email: req.user.email,
        specialization: profile.specialization,
        phone: profile.phone,
        bio: profile.bio,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update or Create Doctor Profile
exports.updateDoctorProfile = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { fullName, specialization, phone, bio } = req.body;

    let profile = await DoctorProfile.findOne({ doctor: doctorId });

    if (profile) {
      // Update existing profile
      profile.fullName = fullName;
      profile.specialization = specialization;
      profile.phone = phone;
      profile.bio = bio;
      await profile.save();
    } else {
      // Create new profile
      profile = await DoctorProfile.create({
        doctor: doctorId,
        fullName,
        specialization,
        phone,
        bio,
      });
    }

    res.status(200).json({ success: true, message: "Profile saved", profile });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};