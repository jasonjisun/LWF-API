const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const availabilityController = require('../controllers/availabilityController');
const verifyJWT = require('../middlewares/verifyJWT');


// Doctor dashboard data
router.get('/dashboard', verifyJWT, doctorController.getDoctorDashboardData);

// Admin or Doctor AVAILABILITY routes
// Set availability (No change needed here)
router.post('/availability', verifyJWT(['doctor', 'admin']), availabilityController.setAvailability);

// Reschedule availability
router.put("/reschedule/:availabilityId", verifyJWT(["admin", "doctor"]), availabilityController.rescheduleAvailability);

// Delete specific time slot from availability
router.delete("/delete/:availabilityId", verifyJWT(["admin", "doctor"]), availabilityController.deleteAvailability);

// PATCH /api/doctor/availability/:id/:status
router.patch(
    "/availability/:id/:status",
    verifyJWT(),
    availabilityController.updateAvailabilityStatus
  );

router.get('/my-availability', verifyJWT(['doctor', 'admin']), availabilityController.getMyAvailabilitySchedule);

// Reschedule an appointment
router.post('/reschedule-appointment/:appointmentId', verifyJWT, doctorController.rescheduleAppointment);

// Create a doctor profile (only doctors)
router.post("/create-profile/:doctorId", verifyJWT(["doctor"]), doctorController.createDoctorProfile);

// Get a doctor's profile (accessible to doctor, patient, admin)
router.get("/profile/:doctorId", verifyJWT(["doctor", "patient", "admin"]), doctorController.getDoctorProfile);

// Get all my confirmed appointments as a doctor
router.get("/appointments/confirmed", verifyJWT(["doctor"]), doctorController.getConfirmedAppointmentsForDoctor);

// Update a doctor's profile (accessible to doctor themselves or admin)
router.put("/profile/:doctorId", verifyJWT(["doctor", "admin"]), doctorController.updateDoctorProfile);

// Delete a doctor's profile (admin only)
router.delete("/profile/:doctorId", verifyJWT(["admin"]), doctorController.deleteDoctorProfile);

module.exports = router;