const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyJWT = require('../middlewares/verifyJWT'); // Ensure JWT verification

// Admin routes
router.get('/dashboard', verifyJWT, adminController.getAdminDashboardData);
router.get(
    "/appointments",
    verifyJWT(["admin"]), // Ensure the user is authenticated as an admin
    adminController.getAllAppointmentsForAdmin
  );

// Confirm appointment
router.patch('/appointments/confirm/:appointmentId', adminController.confirmAppointment);

// Cancel appointment
router.patch('/appointments/cancel/:appointmentId', adminController.cancelAppointment);

// Reschedule appointment
router.patch('/appointments/reschedule/:appointmentId', adminController.rescheduleAppointment);

router.delete("/appointments/:appointmentId", verifyJWT(["admin"]), adminController.deleteAppointmentSchedule);

module.exports = router;
