const Appointment = require('../models/appointmentModel');
const User = require('../models/usersModel');

exports.getAdminDashboardData = async (req, res) => {
  try {
    const todayAppointments = await Appointment.countDocuments({ scheduledDateTime: { $gte: new Date() } });
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const sessionsToday = await Appointment.countDocuments({ sessionDate: { $gte: new Date() } });
    const pendingReports = await Appointment.countDocuments({ reportStatus: 'pending' });

    res.json({
      todayAppointments,
      totalPatients,
      sessionsToday,
      pendingReports,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin dashboard data' });
  }
};

exports.getAdminAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ scheduledDateTime: 1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching appointments' });
  }
};

exports.getPendingAppointments = async (req, res) => {
    try {
        const pendingAppointments = await Appointment.find({ status: "pending" });
        res.status(200).json({ appointments: pendingAppointments });
    } catch (error) {
        console.error("Error fetching pending appointments: ", error);
        res.status(500).json({ message: "Error fetching pending appointments." });
    }
};

exports.confirmAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        // Check if there's any conflict for the confirmed appointment
        const conflictAppointment = await Appointment.findOne({
            doctorId: appointment.doctorId,
            scheduledDateTime: appointment.scheduledDateTime,
            status: { $ne: "canceled" },
        });

        if (conflictAppointment) {
            return res.status(400).json({ message: "Conflict: Doctor is already scheduled." });
        }

        // Update status to confirmed
        appointment.status = "confirmed";
        await appointment.save();

        // Notify the doctor
        // Here you can implement the logic for notification

        res.status(200).json({ message: "Appointment confirmed.", appointment });
    } catch (error) {
        console.error("Error confirming appointment: ", error);
        res.status(500).json({ message: "Error confirming appointment." });
    }
};

exports.cancelAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        // Cancel the appointment
        appointment.status = "canceled";
        await appointment.save();

        res.status(200).json({ message: "Appointment canceled.", appointment });
    } catch (error) {
        console.error("Error canceling appointment: ", error);
        res.status(500).json({ message: "Error canceling appointment." });
    }
};

exports.rescheduleAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { newScheduledDateTime } = req.body;

        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        // Check for conflicts at new time
        const conflictAppointment = await Appointment.findOne({
            doctorId: appointment.doctorId,
            scheduledDateTime: newScheduledDateTime,
            status: { $ne: "canceled" },
            _id: { $ne: appointmentId },
        });

        if (conflictAppointment) {
            return res.status(400).json({ message: "Conflict: Doctor is already scheduled at that time." });
        }

        appointment.scheduledDateTime = newScheduledDateTime;
        appointment.status = "confirmed"; // keep it confirmed
        await appointment.save();

        res.status(200).json({ message: "Appointment rescheduled successfully.", appointment });
    } catch (error) {
        console.error("Error rescheduling appointment:", error);
        res.status(500).json({ message: "Error rescheduling appointment." });
    }
};