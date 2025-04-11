const express = require("express");
const { identifier } = require("../middlewares/identification");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { getEMRByUserId, upsertEMR } = require("../controllers/emrController");

const router = express.Router();

// Doctor/Admin can fetch EMR for any patient
router.get("/:id", identifier, roleMiddleware(["doctor", "admin"]), getEMRByUserId);

// Optional: Create or update EMR
router.post("/", identifier, roleMiddleware(["doctor", "admin"]), upsertEMR);

module.exports = router;