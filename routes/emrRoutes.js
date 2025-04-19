const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const {
  getEMRByUserId,
  upsertEMRByUserId,
  getOwnEMR,
  updateOwnEMR,
} = require("../controllers/emrController");

const router = express.Router();

// 👤 Patient: Get their own EMR
router.get("/own", verifyJWT(["patient"]), getOwnEMR);

// 👤 Patient: Update their own EMR (limited fields)
router.put("/own", verifyJWT(["patient"]), updateOwnEMR);

// 🧑‍⚕️ Doctor/Admin: Get EMR by userId
router.get("/:userId", verifyJWT(["doctor", "admin"]), getEMRByUserId);

// 🧑‍⚕️ Doctor/Admin: Create or update EMR for a specific user
router.post("/:userId", verifyJWT(["doctor", "admin"]), upsertEMRByUserId);

module.exports = router;