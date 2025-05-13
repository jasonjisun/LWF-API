const Appointment = require("../models/appointmentModel");
const DoctorProfile = require("../models/doctorProfileModel");
const PatientProfile = require("../models/patientProfileModel");
const moment = require('moment');

exports.getAppointmentsByFilter = async (req, res) => {
  try {
    const { filter } = req.query;
    const now = moment();

    let startDate, endDate;

    switch (filter) {
      case "day":
        startDate = now.startOf("day").toDate();
        endDate = now.endOf("day").toDate();
        break;
      case "week":
        startDate = now.startOf("isoWeek").toDate(); // ISO week: Monday start
        endDate = now.endOf("isoWeek").toDate();
        break;
      case "month":
        startDate = now.startOf("month").toDate();
        endDate = now.endOf("month").toDate();
        break;
      default:
        return res.status(400).json({ message: "Invalid filter. Use 'day', 'week', or 'month'." });
    }

    const appointments = await Appointment.find({
      scheduledDateTime: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("patient", "fullName email contactNumber")
      .populate("doctor", "fullName email")
      .sort({ scheduledDateTime: 1 });

    res.status(200).json({
      filter,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error("Error fetching filtered appointments:", error);
    res.status(500).json({ message: "Server error while fetching appointments." });
  }
};

exports.getAppointmentsByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;

    // Validate month and year
    if (!month || !year) {
      return res.status(400).json({ message: "Please provide both 'month' and 'year'." });
    }

    // Create moment object for the provided month and year
    const targetDate = moment(`${year}-${month}`, "YYYY-M");

    if (!targetDate.isValid()) {
      return res.status(400).json({ message: "Invalid month or year format." });
    }

    const startDate = targetDate.startOf("month").toDate();
    const endDate = targetDate.endOf("month").toDate();

    // Query appointments within the month
    const appointments = await Appointment.find({
      scheduledDateTime: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("patient", "fullName email contactNumber")
      .populate("doctor", "fullName email")
      .sort({ scheduledDateTime: 1 });

    res.status(200).json({
      month: targetDate.format("MMMM"),
      year,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error("Error fetching appointments by month:", error);
    res.status(500).json({ message: "Server error while fetching appointments." });
  }
};

// Get Confirmed Appointments
exports.getConfirmedAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ status: "confirmed" })
      .populate("patient", "fullName email")
      .lean();

    if (!appointments.length) {
      return res.status(404).json({ message: "No confirmed appointments found." });
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
    
      return {
        appointmentId: appt._id,
        patient: {
          userId: appt.patient?._id,
          fullName: patientInfo.name || appt.patient?.fullName || "Unknown",
          email: appt.patient?.email || null,
          contactNumber: patientInfo.contact || null,
        },
        doctorId: appt.doctor,
        doctorName: doctorMap[appt.doctor?.toString()]?.name || "Doctor not found",
        doctorEmail: doctorMap[appt.doctor?.toString()]?.email || null,
        scheduledDateTime: appt.scheduledDateTime,
        timeSlot: appt.timeSlot,
        status: appt.status,
        reason: appt.reason,
        cancellation: appt.cancellation || {}, // ← this is important
      };
    });
    

    res.status(200).json({ appointments: result });
  } catch (error) {
    console.error("Error fetching confirmed appointments:", error);
    res.status(500).json({ message: "Error retrieving confirmed appointments." });
  }
};

exports.getCancelledAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ status: "cancelled" })
      .populate("patient", "fullName email")
      .lean();

    if (!appointments.length) {
      return res.status(404).json({ message: "No cancelled appointments found." });
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
        cancellation: {
          by: cancellation.by ?? "not specified",
          reason: cancellation.reason ?? "not provided",
          date: cancellation.date ?? null,
        },
      };
    });

    res.status(200).json({ appointments: result });
  } catch (error) {
    console.error("Error fetching cancelled appointments:", error);
    res.status(500).json({ message: "Error retrieving cancelled appointments." });
  }
};


// Get Rescheduled Appointments
exports.getRescheduledAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ status: "rescheduled" })
      .populate("patient", "fullName email")
      .lean();

    if (!appointments.length) {
      return res.status(404).json({ message: "No rescheduled appointments found." });
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

      return {
        appointmentId: appt._id,
        patient: {
          userId: appt.patient?._id,
          fullName: patientInfo.name || appt.patient?.fullName || "Unknown",
          email: appt.patient?.email || null,
          contactNumber: patientInfo.contact || null,
        },
        doctorId: appt.doctor,
        doctorName: doctorMap[appt.doctor?.toString()]?.name || "Doctor not found",
        doctorEmail: doctorMap[appt.doctor?.toString()]?.email || null,
        scheduledDateTime: appt.scheduledDateTime,
        status: appt.status,
        reason: appt.reason,
        timeSlot: appt.timeSlot,
      };
    });

    res.status(200).json({ appointments: result });
  } catch (error) {
    console.error("Error fetching rescheduled appointments:", error);
    res.status(500).json({ message: "Error retrieving rescheduled appointments." });
  }
};
