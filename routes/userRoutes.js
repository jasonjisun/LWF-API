const express = require("express");
const router = express.Router();
const { identifier } = require("../middlewares/identifier"); // Token extraction middleware
const { authMiddleware } = require("../middlewares/authMiddleware"); // JWT validation middleware
const { roleMiddleware } = require("../middlewares/roleMiddleware"); // Role-based access control middleware

// Get user profile (no role restriction, just authenticated)
router.get("/profile", identifier, authMiddleware, (req, res) => {
  res.json({
    message: "User profile",
    user: req.user,  // req.user is set after token is verified in authMiddleware
  });
});

// Admin route: Get all users (only admin can access)
router.get("/admin/users", identifier, authMiddleware, roleMiddleware(["admin"]), (req, res) => {
  res.json({
    message: "All users",
    users: [], // You'll fetch all users from DB here
  });
});

// Doctor route: Get list of patients (only doctors can access)
router.get("/doctor/patients", identifier, authMiddleware, roleMiddleware(["doctor"]), (req, res) => {
  res.json({
    message: "Patient list for doctor",
    patients: [], // You'll fetch patient data here
  });
});

// Update user info (only doctor or admin can update)
router.patch("/user/update", identifier, authMiddleware, roleMiddleware(["doctor", "admin"]), (req, res) => {
  res.json({
    message: "User information updated successfully",
  });
});

// Update own profile (any authenticated user can update their own profile)
router.patch("/profile/update", identifier, authMiddleware, (req, res) => {
  res.json({
    message: "Profile updated successfully",
  });
});

// Admin route: Delete user (only admin can delete users)
router.delete("/admin/user/:userId", identifier, authMiddleware, roleMiddleware(["admin"]), (req, res) => {
  const { userId } = req.params;
  res.json({
    message: `User with ID ${userId} deleted`,
  });
});

module.exports = router;
