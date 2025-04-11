const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const {
  getEMRByUserId,
  upsertEMR,
  getOwnEMR,
  updateOwnEMR,
} = require("../controllers/emrController");

const router = express.Router();

// 🧑‍⚕️ Doctor/Admin: Get EMR by any user ID
router.get("/:id", verifyJWT(["doctor", "admin"]), getEMRByUserId);

// 🧑‍⚕️ Doctor/Admin: Create or update EMR for any user
router.post("/", verifyJWT(["doctor", "admin"]), upsertEMR);

// 👤 Patient: Get their own EMR
router.get("/", verifyJWT(["patient"]), getOwnEMR);

// 👤 Patient: Update their own EMR (only editable fields)
router.put("/", verifyJWT(["patient"]), updateOwnEMR);

module.exports = router;
