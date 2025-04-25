const express = require("express");
const {
  createPatientProfile,
  updatePatientProfile,
  getOwnPatientProfile,
  getPatientProfile,
} = require("../controllers/patientProfileController");
const verifyJWT = require("../middlewares/verifyJWT");

const router = express.Router();

// Get own profile (patient)
router.get("/my-profile", verifyJWT(["patient"]), getOwnPatientProfile);

// Get any patient's profile (admin or doctor)
router.get("/view-profile/:patientId", verifyJWT(["admin", "doctor"]), getPatientProfile);

router.post(
  "/create-profile",
  verifyJWT(["patient"]),
  createPatientProfile
);

router.put("/update-profile", verifyJWT(["patient"]), updatePatientProfile);

module.exports = router;