const Appointment = require('../models/appointmentModel');

exports.getPatientDashboardData = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patient: req.user._id });
    const upcomingAppointments = appointments.filter(
      (appt) => new Date(appt.scheduledDateTime) > new Date()
    );

    res.json({
      upcomingAppointments,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching patient dashboard data' });
  }
};

exports.getAvailableDoctors = async (req, res) => {
  try {
    // Assuming doctors are identified by the "role" field in the user model
    const doctors = await User.find({ role: 'doctor' });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching doctors' });
  }
};

exports.bookAppointment = async (req, res) => {
    try {
        const { doctorId, scheduledDateTime, reason, patientId } = req.body;

        // Check for scheduling conflict (optional since admin will confirm)
        const conflictAppointment = await Appointment.findOne({
            doctorId,
            scheduledDateTime,
            status: { $in: ["confirmed"] }, // only check confirmed ones
        });

        if (conflictAppointment) {
            return res.status(400).json({ message: "Conflict: Doctor is already scheduled." });
        }

        const newAppointment = new Appointment({
            patientId,
            doctorId,
            scheduledDateTime,
            reason,
            status: "pending", // Only confirmed by admin later
        });

        await newAppointment.save();

        res.status(201).json({ message: "Appointment booked successfully.", newAppointment });
    } catch (error) {
        console.error("Error booking appointment:", error);
        res.status(500).json({ message: "Error booking appointment." });
    }
};