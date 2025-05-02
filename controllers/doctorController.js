const Appointment = require('../models/appointmentModel');
const Availability = require('../models/availabilityModel');
const DoctorProfile = require("../models/doctorProfileModel");
const PatientProfile = require("../models/patientProfileModel");

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
exports.getPatientAppointmentsForDoctor = async (req, res) => {
  try {
    const doctorId = req.user._id; // assuming doctor is authenticated via verifyJWT

    const pendingAppointments = await Appointment.find({
      doctor: doctorId,
      status: "pending",
    })
      .populate("patient", "fullName email contactNumber") // show patient details
      .sort({ scheduledDateTime: 1 }); // soonest first

    res.status(200).json({ appointments: pendingAppointments });
  } catch (error) {
    console.error("Error fetching patient appointments:", error);
    res.status(500).json({ message: "Error retrieving appointments." });
  }
};

// Get all confirmed and rescheduled appointments with patient profile details for a doctor
exports.getConfirmedAppointmentsForDoctor = async (req, res) => {
  try {
    const doctorId = req.user._id;

    const appointments = await Appointment.find({
      doctor: doctorId,
      status: { $in: ["confirmed", "rescheduled"] }, // ← key change here
    })
      .populate("patient", "fullName email contactNumber")
      .sort({ scheduledDateTime: 1 });

    // Fetch all related patient profiles
    const patientIds = appointments.map((appt) => appt.patient._id);
    const patientProfiles = await PatientProfile.find({
      user: { $in: patientIds },
    });

    // Map profiles by user ID for quick lookup
    const profileMap = {};
    patientProfiles.forEach((profile) => {
      profileMap[profile.user.toString()] = profile;
    });

    // Attach patientProfile to each appointment
    const appointmentsWithProfiles = appointments.map((appt) => {
      const profile = profileMap[appt.patient._id.toString()] || null;
      return {
        ...appt.toObject(),
        patientProfile: profile,
      };
    });

    res.status(200).json({ appointments: appointmentsWithProfiles });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Error retrieving appointments." });
  }
};


// Doctor or Admin reschedules an appointment
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId, newScheduledDateTime, skipAvailabilityCheck = false } = req.body;
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) return res.status(404).json({ message: "Appointment not found." });

    // If the user is a doctor, they can only reschedule appointments for themselves
    if (req.user.role === "doctor" && appointment.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only reschedule your own appointments." });
    }

    const dateOnly = new Date(newScheduledDateTime).toISOString().split("T")[0];
    const timeOnly = new Date(newScheduledDateTime).toTimeString().slice(0, 5);

    // Log the value of skipAvailabilityCheck for debugging
    console.log('skipAvailabilityCheck:', skipAvailabilityCheck);

    // If skipAvailabilityCheck is not true, check the doctor's availability
    if (skipAvailabilityCheck !== true) {
      const availability = await Availability.findOne({ doctor: appointment.doctor, date: dateOnly });

      if (!availability || !availability.timeSlots.includes(timeOnly)) {
        return res.status(400).json({ message: "Doctor is not available at the selected time." });
      }

      // Remove the old slot after rescheduling
      availability.timeSlots = availability.timeSlots.filter(slot => slot !== timeOnly);
      await availability.save();
    } else {
      console.log('Skipping availability check as per the flag.');
    }

    // Check if the time slot is already booked by another appointment
    const conflict = await Appointment.findOne({
      doctor: appointment.doctor,
      scheduledDateTime: newScheduledDateTime,
      status: { $ne: "cancelled" },
      _id: { $ne: appointmentId },
    });

    if (conflict) {
      return res.status(400).json({ message: "Time slot already booked." });
    }

    // Update the appointment details
    appointment.scheduledDateTime = newScheduledDateTime;
    appointment.timeSlot = timeOnly;
    appointment.status = req.user.role === "admin" ? "confirmed" : "pending";  // Admin confirms, Doctor keeps pending
    await appointment.save();

    res.status(200).json({ message: "Appointment rescheduled.", appointment });
  } catch (error) {
    console.error("Reschedule error:", error);
    res.status(500).json({ message: "Error rescheduling appointment." });
  }
};

// Create a new doctor profile
exports.createDoctorProfile = async (req, res) => {
  try {
    const { fullName, specialization, phone } = req.body;

    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can create profiles." });
    }

    const existingProfile = await DoctorProfile.findOne({ doctor: req.user._id });
    if (existingProfile) {
      return res.status(400).json({ message: "Doctor profile already exists." });
    }

    const newProfile = new DoctorProfile({
      doctor: req.user._id,
      fullName,
      specialization,
      phone,
    });

    const savedProfile = await newProfile.save();

    res.status(201).json(savedProfile);
  } catch (error) {
    console.error("Error creating doctor profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get a doctor's profile by ID
exports.getDoctorProfile = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const profile = await DoctorProfile.findOne({ doctor: doctorId }).populate("doctor", "-password");
    if (!profile) {
      return res.status(404).json({ message: "Doctor profile not found." });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error("Error fetching doctor profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update a doctor's profile
exports.updateDoctorProfile = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { fullName, specialization, phone } = req.body;

    const profile = await DoctorProfile.findOne({ doctor: doctorId });

    if (!profile) {
      return res.status(404).json({ message: "Doctor profile not found." });
    }

    if (req.user.role !== "admin" && String(req.user._id) !== String(profile.doctor)) {
      return res.status(403).json({ message: "Access denied. You cannot edit this profile." });
    }

    if (fullName) profile.fullName = fullName;
    if (specialization) profile.specialization = specialization;
    if (phone) profile.phone = phone;

    const updatedProfile = await profile.save();

    res.status(200).json(updatedProfile);
  } catch (error) {
    console.error("Error updating doctor profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a doctor's profile (admin only)
exports.deleteDoctorProfile = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const profile = await DoctorProfile.findOneAndDelete({ doctor: doctorId });

    if (!profile) {
      return res.status(404).json({ message: "Doctor profile not found." });
    }

    res.status(200).json({ message: "Doctor profile deleted successfully." });
  } catch (error) {
    console.error("Error deleting doctor profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};