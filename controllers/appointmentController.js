const Appointment = require("../models/appointmentModel");
const Availability = require("../models/availabilityModel");

// 🧑‍⚕️ Doctor creates availability
exports.setAvailability = async (req, res) => {
    try {
      const requesterRole = req.user.role;
      let doctorId;
  
      if (requesterRole === "doctor") {
        doctorId = req.user.userId;
      } else if (requesterRole === "admin") {
        doctorId = req.body.doctorId;
        if (!doctorId) {
          return res.status(400).json({ success: false, message: "Doctor ID is required for admin" });
        }
      } else {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }
  
      const { availableSlots } = req.body;
  
      const updated = await Availability.findOneAndUpdate(
        { doctor: doctorId },
        { $set: { availableSlots } },
        { upsert: true, new: true }
      );
  
      res.status(200).json({ success: true, availability: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  

// 👤 Patient books appointment
exports.bookAppointment = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { doctorId, timeSlot, notes } = req.body;

    // Optional: check doctor availability
    const availability = await Availability.findOne({ doctor: doctorId });
    if (!availability || !availability.availableSlots.includes(new Date(timeSlot).toISOString())) {
      return res.status(400).json({ success: false, message: "Slot not available" });
    }

    const appointment = await Appointment.create({
      doctor: doctorId,
      patient: patientId,
      timeSlot,
      notes,
    });

    res.status(201).json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 👑 Admin confirms or rejects appointment
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!["confirmed", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const updated = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Appointment not found" });

    res.status(200).json({ success: true, appointment: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 👤 Patient or doctor views their appointments
exports.getAppointments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    let filter = {};
    if (role === "patient") filter.patient = userId;
    else if (role === "doctor") filter.doctor = userId;

    const appointments = await Appointment.find(filter).populate("doctor patient");

    res.status(200).json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
