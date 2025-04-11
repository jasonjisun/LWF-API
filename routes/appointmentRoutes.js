const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const {
  setAvailability,
  bookAppointment,
  updateAppointmentStatus,
  getAppointments,
} = require("../controllers/appointmentController");

const router = express.Router();

// Admin or Doctor sets availability
router.post("/availability", verifyJWT(["doctor", "admin"]), setAvailability);

// 👤 Patient books appointment
router.post("/book", verifyJWT(["patient"]), bookAppointment);

// 👑 Admin confirms/rejects appointment
router.patch("/:appointmentId/status", verifyJWT(["admin"]), updateAppointmentStatus);

// 🧑‍⚕️ Doctor / 👤 Patient views appointments
router.get("/", verifyJWT(["doctor", "patient"]), getAppointments);

module.exports = router;
