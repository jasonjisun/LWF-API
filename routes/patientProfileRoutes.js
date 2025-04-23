const express = require("express");
const {
  createPatientProfile,
  updatePatientProfile,
} = require("../controllers/patientProfileController");
const { sendVerificationCode } = require("../controllers/authController");
const verifyJWT = require("../middlewares/verifyJWT");

const router = express.Router();

router.post(
  "/create-profile",
  verifyJWT(["patient"]),
  createPatientProfile,
  sendVerificationCode
);

router.put("/update-profile", verifyJWT(["patient"]), updatePatientProfile);

module.exports = router;
