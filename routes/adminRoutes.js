const express = require("express");
const router = express.Router();
const {
  getAllAppointmentsForAdmin,
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
  deleteAppointmentSchedule,
} = require("../controllers/adminController");
const verifyJWT = require("../middlewares/verifyJWT"); // Ensure JWT verification

// Get all appointments for admin
router.get(
  "/appointments",
  verifyJWT(["admin"]), // Ensure the user is authenticated as an admin
  getAllAppointmentsForAdmin
);

// Confirm appointment
router.patch("/appointments/confirm/:appointmentId", confirmAppointment);

// Cancel appointment
router.patch("/appointments/cancel/:appointmentId", cancelAppointment);

// Reschedule appointment
router.patch(
  "/appointments/reschedule/:appointmentId",
  verifyJWT(["admin", "doctor"]),
  rescheduleAppointment
);

// Delete appointment schedule
router.delete(
  "/delete-appointment/:appointmentId",
  verifyJWT(["admin", "doctor"]),
  deleteAppointmentSchedule
);

module.exports = router;
