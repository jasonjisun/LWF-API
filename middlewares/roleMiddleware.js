const jwt = require("jsonwebtoken");
const User = require("../models/usersModel");

const roleMiddleware = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Get token from header
      const token = req.header("Authorization")?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ success: false, message: "Access denied. No token provided." });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.TOKEN_SECRET); // ✅ Ensure this matches authController.js
      console.log("🔹 Decoded Token:", decoded);

      // Fetch user from database
      const user = await User.findById(decoded.userId); // ✅ Corrected from `id` to `userId`

      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ success: false, message: "Access denied. You do not have permission." });
      }

      // Attach user to request object
      req.user = user;
      console.log("✅ Access Granted:", user.role);
      
      next();
    } catch (error) {
      console.log("❌ Role Middleware Error:", error);
      res.status(401).json({ success: false, message: "Invalid token." });
    }
  };
};

module.exports = roleMiddleware;
