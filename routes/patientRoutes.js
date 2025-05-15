const express = require("express");
const router = express.Router();
const {
  getAvailableSchedules,
  bookAppointment,
  cancelAppointment,
  getAvailableDoctors,
  getAllDoctorsWithProfiles,
  getMyAppointmentStatus,
} = require("../controllers/patientController");
const verifyJWT = require("../middlewares/verifyJWT");

router.get("/available-schedules/:doctorId", getAvailableSchedules);

router.patch("/book-appointment/:patientId", bookAppointment);

router.patch("/cancel-appointment/:appointmentId", cancelAppointment);

//Get list of doctors
router.get("/available-doctors", getAvailableDoctors);

// Get all doctors with profiles
router.get("/all-doctors", getAllDoctorsWithProfiles);

router.get("/my-appointments/status", verifyJWT(), getMyAppointmentStatus);

module.exports = router;
