const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const verifyJWT = require('../middlewares/verifyJWT');

// Patient-specific routes (requires patient role)
router.get('/dashboard', verifyJWT(['patient']), patientController.getPatientDashboardData);
router.get('/available-schedules/:doctorId', patientController.getAvailableSchedules);
router.patch("/book-appointment/:patientId", patientController.bookAppointment);


module.exports = router;
