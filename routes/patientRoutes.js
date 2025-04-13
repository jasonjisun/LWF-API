const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const verifyJWT = require('../middlewares/verifyJWT'); // Ensure JWT verification

router.get('/dashboard', verifyJWT, patientController.getPatientDashboardData);
router.get('/available-doctors', verifyJWT, patientController.getAvailableDoctors);
router.post("/book-appointment", patientController.bookAppointment);

module.exports = router;
