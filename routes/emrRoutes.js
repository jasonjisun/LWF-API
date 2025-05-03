const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const {
  getOwnEMR,
  updateEMRByUserId,
  createEMRForUser,
  getPatientEMR,
  getAllPatientEMR,
} = require("../controllers/emrController");

const router = express.Router();

// 🧑‍⚕️ Doctor/Admin: Get all EMRs
router.get("/get-all", verifyJWT(["admin","doctor"]), getAllPatientEMR);

// 👤 Patient: Get their own EMR
router.get("/own", verifyJWT(["patient"]), getOwnEMR);

// 🧑‍⚕️ Doctor/Admin: Get EMR by userId
router.get("/:userId", verifyJWT(["doctor", "admin"]), getPatientEMR);

// 🧑‍⚕️ Doctor/Admin: Create EMR for a new user only
router.post("/:userId", verifyJWT(["doctor","admin"]), createEMRForUser);

// 🧑‍⚕️ Doctor/Admin: Update EMR for an existing user only
router.patch("/:userId", verifyJWT(["doctor", "admin"]), updateEMRByUserId);

module.exports = router;