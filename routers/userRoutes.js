const express = require("express");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { identifier } = require("../middlewares/identification"); // Ensure it's imported
const { getAllUsers, getUserProfile, updateUser, deleteUser } = require("../controllers/userController");

const router = express.Router();

// 👑 Admin - Can view & manage all users
router.get("/all", identifier, roleMiddleware(["admin"]), getAllUsers);
router.put("/update/:id", identifier, roleMiddleware(["admin"]), updateUser);
router.delete("/delete/:id", identifier, roleMiddleware(["admin"]), deleteUser);

// 🏥 Staff - Can view user details (read-only)
router.get("/view/:id", identifier, roleMiddleware(["admin", "staff"]), getUserProfile);

// 👤 Patient - Can only view their own profile
router.get("/profile", identifier, roleMiddleware(["admin", "staff", "patient"]), getUserProfile);

module.exports = router;
