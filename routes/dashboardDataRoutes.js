const express = require("express");
const router = express.Router();
const {
  getConfirmedAppointments,
  getRescheduledAppointments,
  getCancelledAppointments,
  getAppointmentsByFilter,
  getAppointmentsByMonth,
} = require("../controllers/dashboardDataController");
const verifyJWT = require("../middlewares/verifyJWT");

router.get("/appointments/confirmed", verifyJWT(), getConfirmedAppointments);
router.get(
  "/appointments/rescheduled",
  verifyJWT(),
  getRescheduledAppointments
);
router.get("/appointments/cancelled", verifyJWT(), getCancelledAppointments);
router.get("/appointments", verifyJWT(["admin", "doctor"]), getAppointmentsByFilter);
router.get("/by-month",verifyJWT(), getAppointmentsByMonth);

module.exports = router;