const Appointment = require("../models/appointmentModel");
const DoctorProfile = require("../models/doctorProfileModel");
const PatientProfile = require("../models/patientProfileModel");
const User = require("../models/usersModel");
const Availability = require("../models/availabilityModel");

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
      .populate("patient", "fullName email contactNumber") // patient is likely the User ref
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
      patientProfiles.map((p) => [p.user.toString(), p.name || "Unknown"])
    );

    const result = appointments.map((appt) => ({
      appointmentId: appt._id,
      patient: {
        userId: appt.patient?._id,
        fullName:
          patientMap[appt.patient?._id?.toString()] ||
          appt.patient?.fullName ||
          "Unknown",
        email: appt.patient?.email || null,
        contactNumber: appt.patient?.contactNumber || null,
      },
      doctorId: appt.doctor,
      doctorName:
        doctorMap[appt.doctor?.toString()]?.name || "Doctor not found",
      doctorEmail: doctorMap[appt.doctor?.toString()]?.email || null,
      scheduledDateTime: appt.scheduledDateTime,
      status: appt.status,
      reason: appt.reason,
      timeSlot: appt.timeSlot,
    }));

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
      return res.status(404).json({ message: "Appointment not found." });
    }

    // If already confirmed, no need to confirm again
    if (appointment.status === "confirmed") {
      return res
        .status(400)
        .json({ message: "Appointment is already confirmed." });
    }

    // Update the appointment status to 'confirmed'
    appointment.status = "confirmed";
    await appointment.save();

    res.status(200).json({
      message: "Appointment confirmed successfully.",
      appointment,
    });
  } catch (error) {
    console.error("Error confirming appointment:", error);
    res.status(500).json({ message: "Error confirming appointment." });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Find the appointment by ID
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    // If already cancelled, no need to cancel again
    if (appointment.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Appointment is already cancelled." });
    }

    // Update the appointment status to 'cancelled'
    appointment.status = "cancelled";
    await appointment.save();

    res.status(200).json({
      message: "Appointment cancelled successfully.",
      appointment,
    });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
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
      return res.status(404).json({ message: "Appointment not found." });
    }

    // Prevent rescheduling if the appointment is cancelled
    if (appointment.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Cannot reschedule a cancelled appointment." });
    }

    // Ensure doctors only reschedule their own appointments
    if (
      req.user.role === "doctor" &&
      appointment.doctor.toString() !== req.user._id.toString()
    ) {
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
      return res.status(400).json({ message: "Time slot already booked." });
    }

    // Update the appointment's scheduled time and mark it as rescheduled
    appointment.scheduledDateTime = newScheduledDateTime;
    appointment.status = "rescheduled"; // <- Set to rescheduled
    await appointment.save();

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
    res.status(500).json({ message: "Error rescheduling appointment." });
  }
};

exports.deleteAppointmentSchedule = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Check if appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    // Delete the appointment
    await Appointment.findByIdAndDelete(appointmentId);

    res.status(200).json({ message: "Appointment deleted successfully." });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    res.status(500).json({ message: "Error deleting appointment." });
  }
};
