const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const {
  getOwnEMR,
  updateOwnEMR,
  getEMRByUserId,
  updateEMRByUserId,
} = require("../controllers/emrController");

const router = express.Router();

// 👤 Patient: Get their own EMR
router.get("/own", verifyJWT(["patient"]), getOwnEMR);

// 👤 Patient: Update their own EMR (limited fields)
router.put("/own", verifyJWT(["patient"]), updateOwnEMR);

// 🧑‍⚕️ Doctor/Admin: Get EMR by userId
router.get("/:userId", verifyJWT(["doctor", "admin"]), getEMRByUserId);

// 🧑‍⚕️ Doctor/Admin: Update EMR for an existing user only (no upsert)
router.patch("/:userId", verifyJWT(["doctor", "admin"]), updateEMRByUserId);

module.exports = router;