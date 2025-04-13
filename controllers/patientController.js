const Appointment = require('../models/appointmentModel');
const Availability = require('../models/availabilityModel');
const User = require('../models/usersModel'); // Added for getAvailableDoctors

// Get patient dashboard data
exports.getPatientDashboardData = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user._id });
    const upcomingAppointments = appointments.filter(
      (appt) => new Date(appt.scheduledDateTime) > new Date()
    );

    res.json({ upcomingAppointments });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching patient dashboard data' });
  }
};

// Get list of doctors
exports.getAvailableDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching doctors' });
  }
};

// Book an appointment
exports.bookAppointment = async (req, res) => {
  try {
    const { doctor, scheduledDateTime, reason, patientId, contactInfo } = req.body;

    const dateOnly = new Date(scheduledDateTime).toISOString().split("T")[0];
    const timeOnly = new Date(scheduledDateTime).toTimeString().slice(0, 5);

    const availability = await Availability.findOne({ doctor, date: dateOnly });

    if (!availability || !availability.timeSlots.includes(timeOnly)) {
      return res.status(400).json({ message: "Doctor is not available at the selected time." });
    }

    const conflict = await Appointment.findOne({
      doctor: doctor,
      scheduledDateTime,
      status: "confirmed",
    });

    if (conflict) {
      return res.status(400).json({ message: "Time slot already booked." });
    }

    const newAppointment = new Appointment({
      patient: patientId,
      doctor: doctor,
      scheduledDateTime,
      reason,
      timeSlot: timeOnly,
      status: "pending",
      contactInfo,
    });

    await newAppointment.save();

    res.status(201).json({
      message: "Appointment booked successfully.",
      newAppointment: {
        appointmentId: newAppointment._id,
        timeSlot: newAppointment.timeSlot,
        scheduledDateTime: newAppointment.scheduledDateTime,
        reason: newAppointment.reason,
        patient: newAppointment.patient,
        doctor: newAppointment.doctor,
        contactInfo: newAppointment.contactInfo,
        status: newAppointment.status,
        cancellationNote: null,
        __v: newAppointment.__v,
      },
    });
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({ message: "Error booking appointment." });
  }
};


