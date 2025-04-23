const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const {
  getOwnEMR,
  getEMRByUserId,
  updateEMRByUserId,
  createEMRForUser,
} = require("../controllers/emrController");

const router = express.Router();

// 👤 Patient: Get their own EMR
router.get("/own", verifyJWT(["patient"]), getOwnEMR);

// 🧑‍⚕️ Doctor/Admin: Get EMR by userId
router.get("/:userId", verifyJWT(["doctor", "admin"]), getEMRByUserId);

// 🧑‍⚕️ Doctor/Admin: Create EMR for a new user only
router.post("/:userId", verifyJWT(["doctor","admin"]), createEMRForUser);

// 🧑‍⚕️ Doctor/Admin: Update EMR for an existing user only
router.patch("/:userId", verifyJWT(["doctor", "admin"]), updateEMRByUserId);

module.exports = router;