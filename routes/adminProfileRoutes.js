const express = require("express");
const router = express.Router();
const { getAdminProfile, updateAdminProfile,createAdminProfile } = require("../controllers/adminProfileController");
const verifyJWT = require('../middlewares/verifyJWT');

router.get("/:adminId", verifyJWT(["admin"]), getAdminProfile);
router.post("/", verifyJWT(["admin"]), createAdminProfile);
router.put("/:adminId", verifyJWT(["admin"]), updateAdminProfile);

module.exports = router;