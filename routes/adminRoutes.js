const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyJWT = require('../middlewares/verifyJWT'); // Ensure JWT verification

// Admin routes
router.get('/dashboard', verifyJWT, adminController.getAdminDashboardData);
router.get('/appointments', verifyJWT, adminController.getAdminAppointments);
router.get("/pending-appointments", verifyJWT, adminController.getPendingAppointments);

// Admin only actions (add role check)
router.post("/confirm-appointment/:appointmentId", verifyJWT(['admin']), adminController.confirmAppointment);
router.post("/cancel-appointment/:appointmentId", verifyJWT(['admin']), adminController.cancelAppointment);
router.post("/reschedule-appointment/:appointmentId", verifyJWT(['admin']), adminController.rescheduleAppointment);

module.exports = router;
