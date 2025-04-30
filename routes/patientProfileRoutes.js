const express = require("express");
const {
  createPatientProfile,
  updatePatientProfile,
  getOwnPatientProfile,
  getPatientProfile,
  getAllPatientProfiles,
  getPatientVerificationStatus,
  getPatientsWithEmail,
  updateAnyPatientProfile,
} = require("../controllers/patientProfileController");
const verifyJWT = require("../middlewares/verifyJWT");

const router = express.Router();

// Get verification status of a patient (for all roles)
router.get(
  "/verification-status/:patientId",
  verifyJWT(["admin", "doctor", "patient"]),
  getPatientVerificationStatus
);

// Get own profile (patient)
router.get("/my-profile", verifyJWT(["patient"]), getOwnPatientProfile);

// Get any patient's profile (admin or doctor)
router.get("/view-profile/:patientId", verifyJWT(["admin", "doctor"]), getPatientProfile);

router.get("/all-profiles", verifyJWT(["admin", "doctor"]), getAllPatientProfiles,getPatientsWithEmail);

router.post(
  "/create-profile",
  verifyJWT(["patient"]),
  createPatientProfile
);

router.put("/update-profile", verifyJWT(["patient",]), updatePatientProfile);

router.put("/admin-update-profile", verifyJWT(["admin"]), updateAnyPatientProfile);

module.exports = router;