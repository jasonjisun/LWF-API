const Appointment = require('../models/appointmentModel');
const Availability = require('../models/availabilityModel');
const DoctorProfile = require("../models/doctorProfileModel");
const Queue = require('../models/queueModel');
const User = require('../models/usersModel'); // Added for getAvailableDoctors
const PatientProfile = require('../models/patientProfileModel'); // Added for getAvailableDoctors
const Log = require('../models/logsModel');

exports.getAllDoctorsWithProfiles = async (req, res) => {
  try {
    const doctors = await DoctorProfile.find()
      .populate({
        path: "doctor",
        match: { role: "doctor" },
        select: "_id email verified"
      })
      .select("fullName specialization phone doctor"); // Include 'phone'

    // Filter out any where the linked user is null
    const filtered = doctors.filter(doc => doc.doctor);

    res.status(200).json(filtered);
  } catch (error) {
    console.error("Error fetching doctor list:", error);
    res.status(500).json({ message: "Failed to fetch doctor list" });
  }
};


// Get list of doctors
exports.getAvailableDoctors = async (req, res) => {
  try {
    const doctorProfiles = await DoctorProfile.find()
      .populate({
        path: "doctor",
        match: { role: "doctor" },
        select: "_id email",
      })
      .select("fullName specialization doctor");

    const filteredDoctors = doctorProfiles.filter(
      (profile) => profile.doctor !== null
    );

    const doctorsWithStatuses = await Promise.all(
      filteredDoctors.map(async (profile) => {
        const allAvailabilities = await Availability.find({
          doctor: profile.doctor._id,
        });

        const available = allAvailabilities.filter(a => a.status === "available");
        const unavailable = allAvailabilities.filter(a => a.status === "unavailable");

        return {
          ...profile.toObject(),
          availability: {
            available,
            unavailable,
          },
        };
      })
    );

    res.status(200).json(doctorsWithStatuses);
  } catch (error) {
    console.error("Error fetching doctors' availability:", error);
    res.status(500).json({ message: "Error fetching doctors' availability" });
  }
};

exports.getAvailableSchedules = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    // Only fetch availability documents marked as "available"
    const availabilities = await Availability.find({ 
      doctor: doctorId, 
      status: "available" 
    });

    const now = new Date();

    // Get all appointments that are upcoming AND either pending or confirmed
    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      scheduledDateTime: { $gte: now },
      status: { $in: ["pending", "confirmed"] }
    });

    let availableDateTimes = [];

    availabilities.forEach((availability) => {
      const dateObj = new Date(availability.date);
      if (isNaN(dateObj)) return;

      availability.timeSlots.forEach((time) => {
        if (!/^\d{2}:\d{2}$/.test(time)) return;

        const [hour, minute] = time.split(":").map(Number);

        // Construct a local datetime using year/month/day/hour/minute
        const localDateTime = new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate(),
          hour,
          minute
        );

        if (!isNaN(localDateTime)) {
          availableDateTimes.push(localDateTime.toISOString()); // always in UTC
        }
      });
    });

    // Exclude slots already booked (pending or confirmed)
    const bookedSet = new Set(
      bookedAppointments.map((appt) => new Date(appt.scheduledDateTime).toISOString())
    );

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

    // Check if the patient already has a pending appointment
    const existingPendingAppointment = await Appointment.findOne({
      patient: patientId,
      status: 'pending',
    });

    if (existingPendingAppointment) {
      return res.status(400).json({
        message: "You already have a pending appointment. Please wait for it to be confirmed or canceled before booking another one.",
      });
    }

    const user = req.user; // assumes verifyJWT middleware
    const ip = req.ip;
    const endpoint = req.originalUrl;

    // Fetch patient manually by ID
    const patient = await User.findById(patientId);
    if (!patient) {
      await Log.create({
        action: 'Book Appointment - Patient not found',
        role: user?.role || 'unknown',
        email: user?.email || 'unknown',
        ip,
        endpoint
      });
      return res.status(404).json({ message: "Patient not found." });
    }

    const patientProfile = await PatientProfile.findOne({ user: patientId });

    // Restrict unverified patients
    if (!patient.verified) {
      await Log.create({
        action: 'Book Appointment - Unverified account',
        role: user?.role || 'unknown',
        email: user?.email || 'unknown',
        ip,
        endpoint
      });
      return res.status(403).json({
        message: "Account not verified. Please verify your account before booking an appointment.",
      });
    }

    const dateOnly = new Date(scheduledDateTime).toISOString().split("T")[0];
    const timeOnly = new Date(scheduledDateTime).toTimeString().slice(0, 5);
    const latestQueueEntry = await Queue.findOne({}).sort({ queueNumber: -1 });

    const availability = await Availability.findOne({ doctor: doctorId, date: dateOnly });

    if (!availability || !availability.timeSlots.includes(timeOnly)) {
      await Log.create({
        action: 'Book Appointment - Doctor not available',
        role: user?.role || 'unknown',
        email: user?.email || 'unknown',
        ip,
        endpoint
      });
      return res.status(400).json({ message: "Doctor is not available at the selected time." });
    }

    const conflict = await Appointment.findOne({
      doctor: doctorId,
      scheduledDateTime,
      status: "confirmed",
    });

    if (conflict) {
      await Log.create({
        action: 'Book Appointment - Time slot conflict',
        role: user?.role || 'unknown',
        email: user?.email || 'unknown',
        ip,
        endpoint
      });
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

    const newEntry = new Queue({
      patientName: patientProfile.name,
      date: scheduledDateTime,
      queueNumber: latestQueueEntry ? latestQueueEntry.queueNumber + 1 : 1,
      department: 'Priority',
      status: 'waiting',
    });

    await newEntry.save();
    await newAppointment.save();

    await Log.create({
      action: 'Book Appointment - Success',
      role: user?.role || 'unknown',
      email: user?.email || 'unknown',
      ip,
      endpoint
    });

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

    await Log.create({
      action: 'Book Appointment - Server error',
      role: req.user?.role || 'unknown',
      email: req.user?.email || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(500).json({ message: "Error booking appointment." });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Cancellation reason is required." });
    }

    const appointment = await Appointment.findById(appointmentId).populate('patient');
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (appointment.status === "cancelled") {
      return res.status(400).json({ message: "Appointment is already cancelled." });
    }

    appointment.status = "cancelled";
    appointment.cancellation = {
      by: "patient",
      reason: message, // The cancellation message is stored here
      date: new Date(),
    };

    await appointment.save();

    res.status(200).json({
      message: "Appointment has been cancelled.",
      cancellationReason: message,
      appointment,
    });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({ message: "Error cancelling appointment." });
  }
};

exports.getMyAppointmentStatus = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patient: req.user._id }).lean();

    if (appointments.length === 0) {
      return res.status(404).json({ message: 'No appointments found for this patient.' });
    }

    const doctorIds = [...new Set(appointments.map(appt => appt.doctor?.toString()))];

    const profiles = await DoctorProfile.find({ doctor: { $in: doctorIds } }).lean();

    const doctorMap = new Map(
      profiles.map(profile => [profile.doctor.toString(), profile.fullName || 'Doctor not found'])
    );

    const appointmentStatus = appointments.map(appt => {
      const doctorName = doctorMap.get(appt.doctor?.toString()) || 'Doctor not found';
      const isCancelled = appt.status === 'cancelled';
      const cancellation = appt.cancellation || {};

      let cancellationDetails = null;

      if (isCancelled) {
        const by = cancellation.by;
        const isByPatient = by === 'patient';
        const isByAdmin = by === 'admin';

        cancellationDetails = {
          cancelledBy: isByPatient ? 'You' : isByAdmin ? 'Admin' : 'Unknown',
          reasonForCancellation: cancellation.reason || 'Not provided',
          cancelledOn: cancellation.date || null,
        };
      }

      return {
        appointmentId: appt._id,
        doctorId: appt.doctor,
        doctorName,
        scheduledDateTime: appt.scheduledDateTime,
        status: appt.status,
        reason: appt.reason,
        timeSlot: appt.timeSlot,
        ...(cancellationDetails && { cancellationDetails }),
      };
    });

    res.status(200).json({ appointments: appointmentStatus });
  } catch (error) {
    console.error("Error fetching appointment status:", error);
    res.status(500).json({ message: 'Error fetching appointment status.' });
  }
};
