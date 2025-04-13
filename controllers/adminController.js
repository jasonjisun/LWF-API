const Appointment = require("../models/appointmentModel");
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

// All Appointments
exports.getAdminAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({
      scheduledDateTime: 1,
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching appointments" });
  }
};

// Pending Appointments
exports.getPendingAppointments = async (req, res) => {
    try {
      const pendingAppointments = await Appointment.find({ status: "pending" })
        .sort({ scheduledDateTime: 1 })
        .select("-__v") // optional: remove __v if not needed
        .lean(); // return plain JavaScript objects for cleaner manipulation if needed
  
      res.status(200).json({
        message: "Pending appointments fetched successfully.",
        appointments: pendingAppointments.map(appointment => ({
          _id: appointment._id,
          timeSlot: appointment.timeSlot,
          scheduledDateTime: appointment.scheduledDateTime,
          reason: appointment.reason,
          patient: appointment.patient,
          doctor: appointment.doctor,
          contactInfo: appointment.contactInfo,
          status: appointment.status,
          cancellationNote: appointment.cancellationNote || null
        }))
      });
    } catch (error) {
      console.error("Error fetching pending appointments:", error);
      res.status(500).json({ message: "Error fetching pending appointments." });
    }
  };
  

// Confirm Appointment (Admin)
exports.confirmAppointment = async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const appointment = await Appointment.findById(appointmentId);
  
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found." });
      }
  
      const dateOnly = new Date(appointment.scheduledDateTime).toISOString().split("T")[0];
      const timeOnly = appointment.timeSlot;
  
      const availability = await Availability.findOne({
        doctor: appointment.doctor,
        date: dateOnly,
      });
  
      if (!availability || !availability.timeSlots.includes(timeOnly)) {
        return res.status(400).json({ message: "Doctor is not available at that time." });
      }
  
      const conflict = await Appointment.findOne({
        doctor: appointment.doctor,
        scheduledDateTime: appointment.scheduledDateTime,
        status: { $ne: "canceled" },
        _id: { $ne: appointmentId },
      });
  
      if (conflict) {
        return res.status(400).json({ message: "Conflict: Doctor is already scheduled." });
      }
  
      // Confirm appointment
      appointment.status = "confirmed";
      await appointment.save();
  
      // Remove slot from availability
      availability.timeSlots = availability.timeSlots.filter(slot => slot !== timeOnly);
      await availability.save();
  
      res.status(200).json({
        message: "Appointment confirmed.",
        appointment: {
          appointmentId: appointment._id,
          timeSlot: appointment.timeSlot,
          scheduledDateTime: appointment.scheduledDateTime,
          reason: appointment.reason,
          patient: appointment.patient,
          doctor: appointment.doctor,
          contactInfo: appointment.contactInfo,
          status: appointment.status,
          cancellationNote: appointment.cancellationNote || null,
          __v: appointment.__v,
        },
      });
    } catch (error) {
      console.error("Error confirming appointment:", error);
      res.status(500).json({ message: "Error confirming appointment." });
    }
  };
  
  

// Cancel Appointment
exports.cancelAppointment = async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { note } = req.body; // Cancellation note from admin or user
  
      const appointment = await Appointment.findById(appointmentId);
  
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found." });
      }
  
      appointment.status = "canceled";
      appointment.cancellationNote = note || "No reason provided.";
      await appointment.save();
  
      // Restore availability slot
      const dateOnly = new Date(appointment.scheduledDateTime).toISOString().split("T")[0];
      const availability = await Availability.findOne({
        doctor: appointment.doctor,
        date: dateOnly,
      });
  
      if (availability && !availability.timeSlots.includes(appointment.timeSlot)) {
        availability.timeSlots.push(appointment.timeSlot);
        availability.timeSlots.sort(); // Optional: Keep them ordered
        await availability.save();
      }
  
      res.status(200).json({
        message: "Appointment canceled.",
        appointment: {
          appointmentId: appointment._id,
          timeSlot: appointment.timeSlot,
          scheduledDateTime: appointment.scheduledDateTime,
          reason: appointment.reason,
          patient: appointment.patient,
          doctor: appointment.doctor,
          contactInfo: appointment.contactInfo,
          status: appointment.status,
          cancellationNote: appointment.cancellationNote,
          __v: appointment.__v,
        },
      });
    } catch (error) {
      console.error("Error canceling appointment:", error);
      res.status(500).json({ message: "Error canceling appointment." });
    }
  };


// Reschedule by Admin
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newScheduledDateTime } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    const dateOnly = new Date(newScheduledDateTime).toISOString().split("T")[0];
    const timeOnly = new Date(newScheduledDateTime).toTimeString().slice(0, 5);

    const availability = await Availability.findOne({
      doctor: appointment.doctor,
      date: dateOnly,
    });
    if (!availability || !availability.timeSlots.includes(timeOnly)) {
      return res
        .status(400)
        .json({ message: "Doctor is not available at that time." });
    }

    const conflict = await Appointment.findOne({
      doctor: appointment.doctor,
      scheduledDateTime: newScheduledDateTime,
      status: { $ne: "canceled" },
      _id: { $ne: appointmentId },
    });

    if (conflict) {
      return res
        .status(400)
        .json({ message: "Conflict: Doctor is already booked at that time." });
    }

    appointment.scheduledDateTime = newScheduledDateTime;
    appointment.status = "confirmed";
    await appointment.save();

    // TODO: Notify both parties

    res
      .status(200)
      .json({ message: "Appointment rescheduled successfully.", appointment });
  } catch (error) {
    console.error("Error rescheduling appointment:", error);
    res.status(500).json({ message: "Error rescheduling appointment." });
  }
};
