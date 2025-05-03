const Appointment = require("../models/appointmentModel");
const DoctorProfile = require("../models/doctorProfileModel");
const PatientProfile = require("../models/patientProfileModel");
const User = require("../models/usersModel");
const Availability = require("../models/availabilityModel");
const Log = require('../models/logsModel');

// Admin Dashboard Overview
exports.getAdminDashboardData = async (req, res) => {
  try {
    const today = new Date();

    const todayAppointments = await Appointment.countDocuments({
      scheduledDateTime: { $gte: today },
    });
    const totalPatients = await User.countDocuments({ role: "patient" });
    const sessionsToday = await Appointment.countDocuments({
      sessionDate: { $gte: today },
    });
    const pendingReports = await Appointment.countDocuments({
      reportStatus: "pending",
    });

    res.json({
      todayAppointments,
      totalPatients,
      sessionsToday,
      pendingReports,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching admin dashboard data" });
  }
};

exports.getAllAppointmentsForAdmin = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const appointments = await Appointment.find(filter)
      .populate("patient", "fullName email") // Removed contactNumber (not in User schema)
      .lean();

    if (!appointments.length) {
      return res.status(404).json({ message: "No appointments found." });
    }

    const doctorIds = [
      ...new Set(appointments.map((a) => a.doctor?.toString())),
    ];
    const patientUserIds = [
      ...new Set(appointments.map((a) => a.patient?._id?.toString())),
    ];

    // Get doctor profiles
    const profiles = await DoctorProfile.find({ doctor: { $in: doctorIds } })
      .populate("doctor", "email")
      .lean();

    const doctorMap = Object.fromEntries(
      profiles.map((p) => [
        p.doctor._id.toString(),
        {
          name: p.fullName || "Unknown",
          email: p.doctor.email || null,
        },
      ])
    );

    // Get patient profiles
    const patientProfiles = await PatientProfile.find({
      user: { $in: patientUserIds },
    }).lean();

    const patientMap = Object.fromEntries(
      patientProfiles.map((p) => [
        p.user.toString(),
        {
          name: p.name || "Unknown",
          contact: p.contact || null,
        },
      ])
    );

    const result = appointments.map((appt) => {
      const patientId = appt.patient?._id?.toString();
      const patientInfo = patientMap[patientId] || {};

      return {
        appointmentId: appt._id,
        patient: {
          userId: appt.patient?._id,
          fullName: patientInfo.name || appt.patient?.fullName || "Unknown",
          email: appt.patient?.email || null,
          contactNumber: patientInfo.contact || null,
        },
        doctorId: appt.doctor,
        doctorName:
          doctorMap[appt.doctor?.toString()]?.name || "Doctor not found",
        doctorEmail: doctorMap[appt.doctor?.toString()]?.email || null,
        scheduledDateTime: appt.scheduledDateTime,
        status: appt.status,
        reason: appt.reason,
        timeSlot: appt.timeSlot,
      };
    });

    res.status(200).json({ appointments: result });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Error retrieving appointments." });
  }
};


// Confirm the appointment
exports.confirmAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Find the appointment by ID
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      // Log appointment not found
      await Log.create({
        action: 'APPOINTMENT_CONFIRM_FAILED',
        email: req.user ? req.user.email : 'unknown', // Use the authenticated user's email
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId: appointmentId,
        message: 'Appointment not found.',
      });
      return res.status(404).json({ message: "Appointment not found." });
    }

    // If already confirmed, return early
    if (appointment.status === "confirmed") {
      // Log already confirmed appointment
      await Log.create({
        action: 'APPOINTMENT_ALREADY_CONFIRMED',
        email: req.user ? req.user.email : 'unknown', // Use the authenticated user's email
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId: appointmentId,
        message: 'Appointment is already confirmed.',
      });
      return res.status(400).json({ message: "Appointment is already confirmed." });
    }

    // Update the appointment status to 'confirmed'
    appointment.status = "confirmed";
    await appointment.save();

    // Extract relevant fields
    const doctorId = appointment.doctor;
    const date = appointment.scheduledDateTime.toISOString().split('T')[0]; // Get YYYY-MM-DD
    const timeSlot = appointment.timeSlot;

    // Update availability: remove the confirmed timeSlot for the doctor on that date
    await Availability.findOneAndUpdate(
      { doctor: doctorId, date },
      { $pull: { timeSlots: timeSlot } }
    );

    // Log successful appointment confirmation
    await Log.create({
      action: 'APPOINTMENT_CONFIRMED',
      email: req.user ? req.user.email : 'unknown', // Use the authenticated user's email
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId: appointmentId,
      doctorId: doctorId,
      message: 'Appointment confirmed and schedule updated.',
    });

    res.status(200).json({
      message: "Appointment confirmed and schedule updated successfully.",
      appointment,
    });
  } catch (error) {
    console.error("Error confirming appointment:", error);

    // Log any error during appointment confirmation
    await Log.create({
      action: 'APPOINTMENT_CONFIRM_ERROR',
      email: req.user ? req.user.email : 'unknown', // Use the authenticated user's email
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId: req.params.appointmentId,
      message: 'Error confirming appointment.',
      error: error.message,
    });

    res.status(500).json({ message: "Error confirming appointment." });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Find the appointment by ID
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      // Log when the appointment is not found
      await Log.create({
        action: 'APPOINTMENT_CANCEL_FAILED',
        email: req.user ? req.user.email : 'unknown', // Use the authenticated user's email
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId: appointmentId,
        message: 'Appointment not found.',
      });
      return res.status(404).json({ message: "Appointment not found." });
    }

    // If already cancelled, no need to cancel again
    if (appointment.status === "cancelled") {
      // Log if the appointment is already cancelled
      await Log.create({
        action: 'APPOINTMENT_ALREADY_CANCELLED',
        email: req.user ? req.user.email : 'unknown', // Use the authenticated user's email
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId: appointmentId,
        message: 'Appointment is already cancelled.',
      });
      return res.status(400).json({ message: "Appointment is already cancelled." });
    }

    // Update the appointment status to 'cancelled'
    appointment.status = "cancelled";
    await appointment.save();

    // Log successful appointment cancellation
    await Log.create({
      action: 'APPOINTMENT_CANCELLED',
      email: req.user ? req.user.email : 'unknown', // Use the authenticated user's email
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId: appointmentId,
      message: 'Appointment cancelled successfully.',
    });

    res.status(200).json({
      message: "Appointment cancelled successfully.",
      appointment,
    });
  } catch (error) {
    console.error("Error cancelling appointment:", error);

    // Log any error that occurs during the cancellation process
    await Log.create({
      action: 'APPOINTMENT_CANCEL_ERROR',
      email: req.user ? req.user.email : 'unknown', // Use the authenticated user's email
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId: req.params.appointmentId,
      message: 'Error cancelling appointment.',
      error: error.message,
    });

    res.status(500).json({ message: "Error cancelling appointment." });
  }
};

exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newScheduledDateTime } = req.body;

    // Find the appointment by ID
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      // Log when appointment is not found
      await Log.create({
        action: 'APPOINTMENT_RESCHEDULE_FAILED',
        email: req.user ? req.user.email : 'unknown', // Use the authenticated user's email
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId: appointmentId,
        message: 'Appointment not found.',
      });
      return res.status(404).json({ message: "Appointment not found." });
    }

    // Prevent rescheduling if the appointment is cancelled
    if (appointment.status === "cancelled") {
      // Log when appointment is cancelled and can't be rescheduled
      await Log.create({
        action: 'APPOINTMENT_ALREADY_CANCELLED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId: appointmentId,
        message: 'Cannot reschedule a cancelled appointment.',
      });
      return res
        .status(400)
        .json({ message: "Cannot reschedule a cancelled appointment." });
    }

    // Ensure doctors only reschedule their own appointments
    if (
      req.user.role === "doctor" &&
      appointment.doctor.toString() !== req.user._id.toString()
    ) {
      // Log if doctor is trying to reschedule another doctor's appointment
      await Log.create({
        action: 'APPOINTMENT_RESCHEDULE_PERMISSION_DENIED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId: appointmentId,
        message: 'You can only reschedule your own appointments.',
      });
      return res
        .status(403)
        .json({ message: "You can only reschedule your own appointments." });
    }

    // Check if the new time is already booked by another appointment for the same doctor
    const conflict = await Appointment.findOne({
      doctor: appointment.doctor,
      scheduledDateTime: newScheduledDateTime,
      status: { $ne: "cancelled" },
      _id: { $ne: appointmentId },
    });

    if (conflict) {
      // Log if there's a conflict with the new scheduled time
      await Log.create({
        action: 'APPOINTMENT_RESCHEDULE_TIME_CONFLICT',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId: appointmentId,
        message: 'Time slot already booked.',
      });
      return res.status(400).json({ message: "Time slot already booked." });
    }

    // Update the appointment's scheduled time and mark it as rescheduled
    appointment.scheduledDateTime = newScheduledDateTime;
    appointment.status = "rescheduled"; // <- Set to rescheduled
    await appointment.save();

    // Log successful rescheduling
    await Log.create({
      action: 'APPOINTMENT_RESCHEDULED',
      email: req.user ? req.user.email : 'unknown',
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId: appointment._id,
      message: 'Appointment rescheduled successfully.',
    });

    res.status(200).json({
      message: "Appointment rescheduled successfully.",
      appointment: {
        appointmentId: appointment._id,
        scheduledDateTime: appointment.scheduledDateTime,
        status: appointment.status,
        reason: appointment.reason,
      },
    });
  } catch (error) {
    console.error("Error rescheduling appointment:", error);

    // Log error during the rescheduling process
    await Log.create({
      action: 'APPOINTMENT_RESCHEDULE_ERROR',
      email: req.user ? req.user.email : 'unknown',
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId: req.params.appointmentId,
      message: 'Error rescheduling appointment.',
      error: error.message,
    });

    res.status(500).json({ message: "Error rescheduling appointment." });
  }
};

exports.deleteAppointmentSchedule = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Check if appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      // Log when appointment is not found
      await Log.create({
        action: 'APPOINTMENT_DELETION_FAILED',
        email: req.user ? req.user.email : 'unknown', // User's email
        role: req.user ? req.user.role : 'unknown',   // User's role
        ip: req.ip,                                  // User's IP address
        endpoint: req.originalUrl,                   // Request endpoint
        appointmentId: appointmentId,                // Appointment ID
        message: 'Appointment not found.',
      });
      return res.status(404).json({ message: "Appointment not found." });
    }

    // Delete the appointment
    await Appointment.findByIdAndDelete(appointmentId);

    // Log successful deletion
    await Log.create({
      action: 'APPOINTMENT_DELETED',
      email: req.user ? req.user.email : 'unknown',
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId: appointmentId,
      message: 'Appointment deleted successfully.',
    });

    res.status(200).json({ message: "Appointment deleted successfully." });
  } catch (error) {
    console.error("Error deleting appointment:", error);

    // Log error during the deletion process
    await Log.create({
      action: 'APPOINTMENT_DELETION_ERROR',
      email: req.user ? req.user.email : 'unknown',
      role: req.user ? req.user.role : 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId: req.params.appointmentId,
      message: 'Error deleting appointment.',
      error: error.message, // Include the error message for debugging
    });

    res.status(500).json({ message: "Error deleting appointment." });
  }
};
