const Appointment = require('../models/appointmentModel');
const Availability = require('../models/availabilityModel');
const DoctorProfile = require("../models/doctorProfileModel");
const PatientProfile = require("../models/patientProfileModel");
const Log = require('../models/logsModel');

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

    // Check if the appointment exists
    if (!appointment) {
      await Log.create({
        action: 'RESCHEDULE_APPOINTMENT_FAILED',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl,
        message: 'Appointment not found.',
        details: { appointmentId },
      });
      return res.status(404).json({ message: "Appointment not found." });
    }

    // Check if the doctor is rescheduling their own appointment
    if (req.user.role === "doctor" && appointment.doctor.toString() !== req.user._id.toString()) {
      await Log.create({
        action: 'RESCHEDULE_APPOINTMENT_FAILED',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl,
        message: 'You can only reschedule your own appointments.',
        details: { appointmentId },
      });
      return res.status(403).json({ message: "You can only reschedule your own appointments." });
    }

    // Extract date and time from newScheduledDateTime
    const newDate = new Date(newScheduledDateTime);
    const dateOnly = newDate.toISOString().split("T")[0];
    const timeOnly = newDate.toTimeString().slice(0, 5);

    // Log the skipAvailabilityCheck flag
    console.log('skipAvailabilityCheck:', skipAvailabilityCheck);

    // If skipAvailabilityCheck is false, check if doctor is available
    if (skipAvailabilityCheck !== true) {
      const availability = await Availability.findOne({ doctor: appointment.doctor, date: dateOnly });

      if (!availability || !availability.timeSlots.includes(timeOnly)) {
        await Log.create({
          action: 'RESCHEDULE_APPOINTMENT_FAILED',
          email: req.user.email,
          role: req.user.role,
          ip: req.ip,
          endpoint: req.originalUrl,
          message: 'Doctor is not available at the selected time.',
          details: { appointmentId, dateOnly, timeOnly },
        });
        return res.status(400).json({ message: "Doctor is not available at the selected time." });
      }

      // Remove the old slot from the availability
      availability.timeSlots = availability.timeSlots.filter(slot => slot !== appointment.timeSlot);
      await availability.save();
    } else {
      console.log('Skipping availability check as per the flag.');
    }

    // Check for conflict with existing appointments
    const conflict = await Appointment.findOne({
      doctor: appointment.doctor,
      scheduledDateTime: newScheduledDateTime,
      status: { $ne: "cancelled" },
      _id: { $ne: appointmentId },
    });

    if (conflict) {
      await Log.create({
        action: 'RESCHEDULE_APPOINTMENT_FAILED',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl,
        message: 'Time slot already booked.',
        details: { appointmentId, newScheduledDateTime },
      });
      return res.status(400).json({ message: "Time slot already booked." });
    }

    // Update the appointment with the new date and time slot
    appointment.scheduledDateTime = newScheduledDateTime;
    appointment.timeSlot = timeOnly;
    appointment.status = req.user.role === "admin" ? "confirmed" : "pending";  // Admin confirms, Doctor keeps pending
    await appointment.save();

    // Log the successful reschedule action
    await Log.create({
      action: 'APPOINTMENT_RESCHEDULED',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Appointment successfully rescheduled.',
      details: { appointmentId, newScheduledDateTime, timeSlot: timeOnly },
    });

    res.status(200).json({ message: "Appointment rescheduled.", appointment });
  } catch (error) {
    console.error("Reschedule error:", error);

    // Log the error during rescheduling
    await Log.create({
      action: 'RESCHEDULE_APPOINTMENT_ERROR',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Error rescheduling appointment.',
      error: error.message,  // Include error message for debugging
      details: { appointmentId, newScheduledDateTime },
    });

    res.status(500).json({ message: "Error rescheduling appointment." });
  }
};

// Create a new doctor profile
exports.createDoctorProfile = async (req, res) => {
  try {
    const { fullName, specialization, phone } = req.body;

    // Validate inputs
    if (!fullName || !specialization || !phone) {
      return res.status(400).json({ message: "Full name, specialization, and phone are required." });
    }

    // Check if the user is a doctor
    if (req.user.role !== "doctor") {
      await Log.create({
        action: 'CREATE_DOCTOR_PROFILE_FAILED',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl,
        message: 'Only doctors can create profiles.',
        details: { userId: req.user._id },
      });
      return res.status(403).json({ message: "Only doctors can create profiles." });
    }

    // Check if the doctor already has a profile
    const existingProfile = await DoctorProfile.findOne({ doctor: req.user._id });
    if (existingProfile) {
      await Log.create({
        action: 'CREATE_DOCTOR_PROFILE_FAILED',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl,
        message: 'Doctor profile already exists.',
        details: { userId: req.user._id },
      });
      return res.status(400).json({ message: "Doctor profile already exists." });
    }

    // Check if the phone number is already taken by another doctor
    const existingPhone = await DoctorProfile.findOne({ phone });
    if (existingPhone) {
      await Log.create({
        action: 'CREATE_DOCTOR_PROFILE_FAILED',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl,
        message: 'Phone number already associated with another doctor profile.',
        details: { phone },
      });
      return res.status(400).json({ message: "Phone number already associated with another doctor profile." });
    }

    // Create the new doctor profile
    const newProfile = new DoctorProfile({
      doctor: req.user._id,
      fullName,
      specialization,
      phone,
    });

    // Save the profile
    const savedProfile = await newProfile.save();

    // Log successful profile creation
    await Log.create({
      action: 'CREATE_DOCTOR_PROFILE',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Doctor profile created successfully.',
      details: { doctorId: req.user._id, savedProfile },
    });

    res.status(201).json(savedProfile);

  } catch (error) {
    console.error("Error creating doctor profile:", error);

    // Log the error for traceability
    await Log.create({
      action: 'CREATE_DOCTOR_PROFILE_ERROR',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Error creating doctor profile.',
      error: error.message,  // Include error message for debugging
      details: { userId: req.user._id },
    });

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

    // Validate inputs
    if (!fullName && !specialization && !phone) {
      return res.status(400).json({ message: "At least one field (fullName, specialization, or phone) is required to update." });
    }

    // Find the doctor profile by ID
    const profile = await DoctorProfile.findOne({ doctor: doctorId });

    if (!profile) {
      return res.status(404).json({ message: "Doctor profile not found." });
    }

    // Ensure the user has access to edit the profile (Admin or the doctor themselves)
    if (req.user.role !== "admin" && String(req.user._id) !== String(profile.doctor)) {
      await Log.create({
        action: 'UPDATE_DOCTOR_PROFILE_FAILED',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl,
        message: 'Access denied. User does not have permission to edit this profile.',
        details: { userId: req.user._id, doctorId: profile.doctor },
      });
      return res.status(403).json({ message: "Access denied. You cannot edit this profile." });
    }

    // If phone is updated, check if it's already taken by another doctor
    if (phone && phone !== profile.phone) {
      const existingPhone = await DoctorProfile.findOne({ phone });
      if (existingPhone) {
        await Log.create({
          action: 'UPDATE_DOCTOR_PROFILE_FAILED',
          email: req.user.email,
          role: req.user.role,
          ip: req.ip,
          endpoint: req.originalUrl,
          message: 'Phone number already associated with another doctor profile.',
          details: { phone },
        });
        return res.status(400).json({ message: "Phone number already associated with another doctor profile." });
      }
      profile.phone = phone; // Update phone number if it's unique
    }

    // Update the profile fields if they are provided
    if (fullName) profile.fullName = fullName;
    if (specialization) profile.specialization = specialization;

    // Save the updated profile
    const updatedProfile = await profile.save();

    // Log successful profile update
    await Log.create({
      action: 'UPDATE_DOCTOR_PROFILE',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Doctor profile updated successfully.',
      details: { doctorId: profile.doctor, updatedProfile },
    });

    res.status(200).json(updatedProfile);
    
  } catch (error) {
    console.error("Error updating doctor profile:", error);

    // Log the error for traceability
    await Log.create({
      action: 'UPDATE_DOCTOR_PROFILE_ERROR',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Error updating doctor profile.',
      error: error.message,  // Include error message for debugging
      details: { userId: req.user._id, doctorId },
    });

    res.status(500).json({ message: "Server error" });
  }
};

// Delete a doctor's profile (admin only)
exports.deleteDoctorProfile = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Find the doctor profile by doctorId
    const profile = await DoctorProfile.findOne({ doctor: doctorId });

    if (!profile) {
      return res.status(404).json({ message: "Doctor profile not found." });
    }

    // Check if the user is an admin or the doctor themselves
    if (req.user.role !== "admin" && String(req.user._id) !== String(profile.doctor)) {
      // Log the unauthorized deletion attempt
      await Log.create({
        action: 'DELETE_DOCTOR_PROFILE_FAILED',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl,
        message: 'Access denied. User cannot delete this profile.',
        details: { userId: req.user._id, doctorId: profile.doctor },
      });
      return res.status(403).json({ message: "Access denied. You cannot delete this profile." });
    }

    // Proceed to delete the doctor profile
    await DoctorProfile.findOneAndDelete({ doctor: doctorId });

    // Log the successful profile deletion
    await Log.create({
      action: 'DELETE_DOCTOR_PROFILE',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Doctor profile deleted successfully.',
      details: { doctorId },
    });

    res.status(200).json({ message: "Doctor profile deleted successfully." });

  } catch (error) {
    console.error("Error deleting doctor profile:", error);

    // Log the error for traceability
    await Log.create({
      action: 'DELETE_DOCTOR_PROFILE_ERROR',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Error deleting doctor profile.',
      error: error.message,  // Include error message for debugging
      details: { userId: req.user._id, doctorId },
    });

    res.status(500).json({ message: "Server error" });
  }
};