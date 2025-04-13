const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const availabilityController = require('../controllers/availabilityController'); // Import the correct controller
const verifyJWT = require('../middlewares/verifyJWT'); // Ensure JWT verification

// Admin or Doctor sets availability
router.post('/availability', verifyJWT(['doctor', 'admin']), availabilityController.setAvailability); // Corrected to use availabilityController

// Doctor dashboard data
router.get('/dashboard', verifyJWT, doctorController.getDoctorDashboardData);

// Get doctor appointments
router.get('/appointments', verifyJWT, doctorController.getAppointments);

// Reschedule an appointment
router.post('/reschedule-appointment', verifyJWT, doctorController.rescheduleAppointment);

module.exports = router;