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

exports.getAvailableSchedules = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const availabilities = await Availability.find({ doctor: doctorId });

    const now = new Date();
    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      scheduledDateTime: { $gte: now },
    });

    let availableDateTimes = [];

    availabilities.forEach((availability) => {
      const date = new Date(availability.date);
      if (isNaN(date)) return; // Skip if invalid

      const dateStr = date.toISOString().slice(0, 10);

      availability.timeSlots.forEach((time) => {
        if (!/^\d{2}:\d{2}$/.test(time)) return; // Ensure HH:MM format

        const dateTime = new Date(`${dateStr}T${time}:00`);
        if (!isNaN(dateTime)) {
          availableDateTimes.push(dateTime.toISOString());
        }
      });
    });

    // Remove booked appointments
    const bookedSet = new Set(bookedAppointments.map((appt) =>
      new Date(appt.scheduledDateTime).toISOString()
    ));

    const filtered = availableDateTimes.filter(dt => !bookedSet.has(dt));

    res.status(200).json({ availableSchedules: filtered });
  } catch (error) {
    console.error("Error fetching available schedules:", error);
    res.status(500).json({ message: "Error fetching available schedules." });
  }
};

exports.bookAppointment = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctorId, scheduledDateTime, reason, contactInfo } = req.body;

    // Fetch patient manually by ID
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    // Restrict unverified patients
    if (!patient.verified) {
      return res.status(403).json({
        message: "Account not verified. Please verify your account before booking an appointment.",
      });
    }

    const dateOnly = new Date(scheduledDateTime).toISOString().split("T")[0];
    const timeOnly = new Date(scheduledDateTime).toTimeString().slice(0, 5);

    const availability = await Availability.findOne({ doctor: doctorId, date: dateOnly });

    if (!availability || !availability.timeSlots.includes(timeOnly)) {
      return res.status(400).json({ message: "Doctor is not available at the selected time." });
    }

    const conflict = await Appointment.findOne({
      doctor: doctorId,
      scheduledDateTime,
      status: "confirmed",
    });

    if (conflict) {
      return res.status(400).json({ message: "Time slot already booked." });
    }

    const newAppointment = new Appointment({
      patient: patientId,
      doctor: doctorId,
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