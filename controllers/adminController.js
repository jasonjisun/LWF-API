const Appointment = require("../models/appointmentModel");
const DoctorProfile = require("../models/doctorProfileModel");
const PatientProfile = require("../models/patientProfileModel");
const User = require("../models/usersModel");
const Availability = require("../models/availabilityModel");
const Log = require('../models/logsModel');
const transport = require("../middlewares/sendMail");

// Admin Dashboard Overview

exports.getAllAppointmentsForAdmin = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const appointments = await Appointment.find(filter)
      .populate("patient", "fullName email")
      .lean();

    if (!appointments.length) {
      return res.status(404).json({ message: "No appointments found." });
    }

    const doctorIds = [...new Set(appointments.map((a) => a.doctor?.toString()))];
    const patientUserIds = [...new Set(appointments.map((a) => a.patient?._id?.toString()))];

    const doctorProfiles = await DoctorProfile.find({ doctor: { $in: doctorIds } })
      .populate("doctor", "email")
      .lean();

    const patientProfiles = await PatientProfile.find({ user: { $in: patientUserIds } }).lean();

    const doctorMap = Object.fromEntries(
      doctorProfiles.map((p) => [
        p.doctor._id.toString(),
        {
          name: p.fullName || "Unknown",
          email: p.doctor.email || null,
        },
      ])
    );

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
      const doctorInfo = doctorMap[appt.doctor?.toString()] || {};
      const cancellation = appt.cancellation || {};

      return {
        appointmentId: appt._id,
        patient: {
          userId: appt.patient?._id,
          fullName: patientInfo.name || appt.patient?.fullName || "Unknown",
          email: appt.patient?.email || null,
          contactNumber: patientInfo.contact || null,
        },
        doctorId: appt.doctor,
        doctorName: doctorInfo.name || "Doctor not found",
        doctorEmail: doctorInfo.email || null,
        scheduledDateTime: appt.scheduledDateTime,
        timeSlot: appt.timeSlot,
        status: appt.status,
        reason: appt.reason || null,
        ...(appt.status === "cancelled" && {
          cancellation: {
            by: cancellation.by ?? "not specified",
            reason: cancellation.reason ?? "not provided",
            date: cancellation.date ?? null,
          },
        }),
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
    const appointment = await Appointment.findById(appointmentId).populate('patient');
    if (!appointment) {
      await Log.create({
        action: 'APPOINTMENT_CONFIRM_FAILED',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId,
        message: 'Appointment not found.',
      });
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (appointment.status === "confirmed") {
      await Log.create({
        action: 'APPOINTMENT_ALREADY_CONFIRMED',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId,
        message: 'Appointment is already confirmed.',
      });
      return res.status(400).json({ message: "Appointment is already confirmed." });
    }

    // Update appointment status
    appointment.status = "confirmed";
    await appointment.save();

    const doctorId = appointment.doctor;
    const date = appointment.scheduledDateTime.toISOString().split('T')[0];
    const timeSlot = appointment.timeSlot;

    await Availability.findOneAndUpdate(
      { doctor: doctorId, date },
      { $pull: { timeSlots: timeSlot } }
    );

    await Log.create({
      action: 'APPOINTMENT_CONFIRMED',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId,
      doctorId,
      message: 'Appointment confirmed and schedule updated.',
    });

    // Send confirmation email
    const patientEmail = appointment.patient?.email;
    if (patientEmail) {
      await transport.sendMail({
        from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
        to: patientEmail,
        subject: "Appointment Confirmation",
        html: `
          <h3>Your Appointment is Confirmed</h3>
          <p>Dear ${appointment.patient?.name || "Patient"},</p>
          <p>Your appointment has been successfully confirmed.</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${timeSlot}</p>
          <p>Thank you!</p>
        `
      });
    }

    res.status(200).json({
      message: "Appointment confirmed and schedule updated successfully.",
      appointment,
    });
  } catch (error) {
    console.error("Error confirming appointment:", error);

    await Log.create({
      action: 'APPOINTMENT_CONFIRM_ERROR',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
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
    const { message } = req.body; // The cancellation reason/message provided

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Cancellation message is required." });
    }

    // Find the appointment by ID and populate patient details
    const appointment = await Appointment.findById(appointmentId).populate('patient');
    if (!appointment) {
      await Log.create({
        action: 'APPOINTMENT_CANCEL_FAILED',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId,
        message: 'Appointment not found.',
      });
      return res.status(404).json({ message: "Appointment not found." });
    }

    // Check if appointment is already cancelled
    if (appointment.status === "cancelled") {
      await Log.create({
        action: 'APPOINTMENT_ALREADY_CANCELLED',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId,
        message: 'Appointment is already cancelled.',
      });
      return res.status(400).json({ message: "Appointment is already cancelled." });
    }

    // Determine who is cancelling the appointment
    const cancellationBy = req.user?.role === 'admin' ? 'admin' : req.user?.role;

    // Set cancellation details
    appointment.status = "cancelled";
    appointment.cancellation = {
      by: cancellationBy,
      reason: message,
      date: new Date(),
    };

    // Save the appointment with updated cancellation details
    await appointment.save();

    // Log the cancellation action
    await Log.create({
      action: 'APPOINTMENT_CANCELLED',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId,
      message: `Appointment cancelled. Reason: ${message}`,
    });

    // Send cancellation email to the patient
    const patientEmail = appointment.patient?.email;
    if (patientEmail) {
      await transport.sendMail({
        from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
        to: patientEmail,
        subject: "Appointment Cancelled",
        html: `
          <h3>Your Appointment Has Been Cancelled</h3>
          <p>Dear ${appointment.patient?.name || "Patient"},</p>
          <p>We regret to inform you that your appointment has been cancelled. Reason: ${message}</p>
          <p>If you have any questions or wish to reschedule, please contact us.</p>
          <p>Thank you!</p>
        `
      });
    }

    res.status(200).json({
      message: "Appointment cancelled successfully.",
      cancellationMessage: message,
      appointment,
    });
  } catch (error) {
    console.error("Error cancelling appointment:", error);

    // Log the error if cancelling fails
    await Log.create({
      action: 'APPOINTMENT_CANCEL_ERROR',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
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
    // ✅ Validate newScheduledDateTime early
    if (!newScheduledDateTime || isNaN(new Date(newScheduledDateTime).getTime())) {
      return res.status(400).json({ message: "Invalid newScheduledDateTime." });
    }

    const appointment = await Appointment.findById(appointmentId).populate('patient');
    if (!appointment) {
      await Log.create({
        action: 'APPOINTMENT_RESCHEDULE_FAILED',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId,
        message: 'Appointment not found.',
      });
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (appointment.status === "cancelled") {
      await Log.create({
        action: 'APPOINTMENT_ALREADY_CANCELLED',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId,
        message: 'Cannot reschedule a cancelled appointment.',
      });
      return res.status(400).json({ message: "Cannot reschedule a cancelled appointment." });
    }

    if (
      req.user.role === "doctor" &&
      appointment.doctor.toString() !== req.user._id.toString()
    ) {
      await Log.create({
        action: 'APPOINTMENT_RESCHEDULE_PERMISSION_DENIED',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId,
        message: 'You can only reschedule your own appointments.',
      });
      return res.status(403).json({ message: "You can only reschedule your own appointments." });
    }

    const conflict = await Appointment.findOne({
      doctor: appointment.doctor,
      scheduledDateTime: newScheduledDateTime,
      status: { $ne: "cancelled" },
      _id: { $ne: appointmentId },
    });

    if (conflict) {
      await Log.create({
        action: 'APPOINTMENT_RESCHEDULE_TIME_CONFLICT',
        email: req.user?.email || 'unknown',
        role: req.user?.role || 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        appointmentId,
        message: 'Time slot already booked.',
      });
      return res.status(400).json({ message: "Time slot already booked." });
    }

    appointment.scheduledDateTime = newScheduledDateTime;
    appointment.status = "rescheduled";
    await appointment.save();

    await Log.create({
      action: 'APPOINTMENT_RESCHEDULED',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl,
      appointmentId: appointment._id,
      message: 'Appointment rescheduled successfully.',
    });

    // Send reschedule confirmation email
    const patientEmail = appointment.patient?.email;
    const rescheduleDate = new Date(newScheduledDateTime).toISOString().split("T")[0];
    const rescheduleTime = new Date(newScheduledDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (patientEmail) {
      await transport.sendMail({
        from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
        to: patientEmail,
        subject: "Appointment Rescheduled",
        html: `
          <h3>Your Appointment Has Been Rescheduled</h3>
          <p>Dear ${appointment.patient?.name || "Patient"},</p>
          <p>Your appointment has been successfully rescheduled.</p>
          <p><strong>New Date:</strong> ${rescheduleDate}</p>
          <p><strong>New Time:</strong> ${rescheduleTime}</p>
          <p>If this wasn't you, please contact us immediately.</p>
        `,
      });
    }

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

    await Log.create({
      action: 'APPOINTMENT_RESCHEDULE_ERROR',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
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
