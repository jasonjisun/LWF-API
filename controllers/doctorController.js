const Appointment = require('../models/appointmentModel');

exports.getDoctorDashboardData = async (req, res) => {
  try {
    const todayAppointments = await Appointment.countDocuments({
      doctor: req.user._id,
      scheduledDateTime: { $gte: new Date() },
    });
    const sessionsToday = await Appointment.countDocuments({
      doctor: req.user._id,
      sessionDate: { $gte: new Date() },
    });

    res.json({
      todayAppointments,
      sessionsToday,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching doctor dashboard data' });
  }
};

exports.getAppointments = async (req, res) => {
    try {
        const doctorId = req.user.id; // Assuming you're using authentication

        const appointments = await Appointment.find({ doctorId });

        res.status(200).json({ appointments });
    } catch (error) {
        console.error("Error fetching doctor appointments: ", error);
        res.status(500).json({ message: "Error fetching doctor appointments." });
    }
};

exports.rescheduleAppointment = async (req, res) => {
    try {
        const { appointmentId, newScheduledDateTime } = req.body;

        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        // Check for conflicts on the new date
        const conflictAppointment = await Appointment.findOne({
            doctorId: appointment.doctorId,
            scheduledDateTime: newScheduledDateTime,
            status: { $ne: "canceled" },
        });

        if (conflictAppointment) {
            return res.status(400).json({ message: "Conflict: Doctor is already scheduled." });
        }

        // Reschedule the appointment
        appointment.scheduledDateTime = newScheduledDateTime;
        appointment.status = "pending"; // It might go back to pending until admin confirms
        await appointment.save();

        res.status(200).json({ message: "Appointment rescheduled.", appointment });
    } catch (error) {
        console.error("Error rescheduling appointment: ", error);
        res.status(500).json({ message: "Error rescheduling appointment." });
    }
};
