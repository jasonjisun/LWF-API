const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const availabilityController = require('../controllers/availabilityController');
const verifyJWT = require('../middlewares/verifyJWT');

// Admin or Doctor sets availability
router.post('/availability', verifyJWT(['doctor', 'admin']), availabilityController.setAvailability);

// Doctor dashboard data
router.get('/dashboard', verifyJWT, doctorController.getDoctorDashboardData);

// Get doctor appointments
router.get('/appointments', verifyJWT, doctorController.getAppointments);

// Reschedule an appointment
router.post('/reschedule-appointment', verifyJWT, doctorController.rescheduleAppointment);

// Get doctor profile
router.get("/profile", verifyJWT, doctorController.getDoctorProfile);

// Create Doctor Profile
router.post('/create-doctor-profile', verifyJWT, doctorController.createDoctorProfile);

// Update doctor profile
router.put("/profile", verifyJWT, doctorController.updateDoctorProfile);

module.exports = router;