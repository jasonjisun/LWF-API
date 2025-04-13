const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyJWT = require('../middlewares/verifyJWT'); // Ensure JWT verification

router.get('/dashboard', verifyJWT, adminController.getAdminDashboardData);
router.get('/appointments', verifyJWT, adminController.getAdminAppointments);
router.get("/pending-appointments", adminController.getPendingAppointments);
router.post("/confirm-appointment/:appointmentId", adminController.confirmAppointment);
router.post("/cancel-appointment/:appointmentId", adminController.cancelAppointment);
router.post("/reschedule-appointment/:appointmentId", adminController.rescheduleAppointment);

module.exports = router;
