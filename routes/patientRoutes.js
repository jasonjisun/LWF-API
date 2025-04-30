const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const verifyJWT = require('../middlewares/verifyJWT');

// Patient-specific routes (requires patient role)
router.get('/dashboard', verifyJWT(['patient']), patientController.getPatientDashboardData);

router.get('/available-schedules/:doctorId', patientController.getAvailableSchedules);

router.patch("/book-appointment/:patientId", patientController.bookAppointment);

//Get list of doctors
router.get('/available-doctors', patientController.getAvailableDoctors);

// Get all doctors with profiles
router.get("/all-doctors", patientController.getAllDoctorsWithProfiles);

module.exports = router;
