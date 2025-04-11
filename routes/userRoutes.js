const express = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const {
  getAllUsers,
  getUserProfile,
  updateUser,
  deleteUser,
} = require("../controllers/userController");

const router = express.Router();

// 👑 Admin - Can view & manage all users
router.get("/all", verifyJWT(["admin"]), getAllUsers);
router.put("/update/:id", verifyJWT(["admin"]), updateUser);
router.delete("/delete/:id", verifyJWT(["admin"]), deleteUser);

// 🏥 Doctor - Can view user details (read-only)
router.get("/view/:id", verifyJWT(["admin", "doctor"]), getUserProfile);

// 👤 Patient - Can only view their own profile
router.get("/profile", verifyJWT(["admin", "doctor", "patient"]), getUserProfile);

module.exports = router;