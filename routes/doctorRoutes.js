const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const availabilityController = require('../controllers/availabilityController');
const verifyJWT = require('../middlewares/verifyJWT');

// Admin or Doctor sets availability
router.post('/availability', verifyJWT(['doctor', 'admin']), availabilityController.setAvailability);

// Doctor dashboard data
router.get('/dashboard', verifyJWT, doctorController.getDoctorDashboardData);

// Reschedule an appointment
router.post('/reschedule-appointment', verifyJWT, doctorController.rescheduleAppointment);

// Create a doctor profile (only doctors)
router.post("/profile", verifyJWT(["doctor"]), doctorController.createDoctorProfile);

// Get a doctor's profile (accessible to doctor, patient, admin)
router.get("/profile/:doctorId", verifyJWT(["doctor", "patient", "admin"]), doctorController.getDoctorProfile);

// Update a doctor's profile (accessible to doctor themselves or admin)
router.put("/profile/:doctorId", verifyJWT(["doctor", "admin"]), doctorController.updateDoctorProfile);

// Delete a doctor's profile (admin only)
router.delete("/profile/:doctorId", verifyJWT(["admin"]), doctorController.deleteDoctorProfile);

module.exports = router;