const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const verifyJWT = require('../middlewares/verifyJWT'); // Ensure JWT verification

// Patient-specific routes (requires patient role)
router.get('/dashboard', verifyJWT(['patient']), patientController.getPatientDashboardData);
router.get('/available-doctors', verifyJWT(['patient']), patientController.getAvailableDoctors);
router.post("/book-appointment", verifyJWT(['patient']), patientController.bookAppointment);

module.exports = router;
