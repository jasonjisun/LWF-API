const jwt = require("jsonwebtoken");
const User = require("../models/usersModel");

const roleMiddleware = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Get access token from cookies
      let token = req.cookies.Authorization?.split("Bearer ")[1];

      if (!token) {
        return res
          .status(401)
          .json({
            success: false,
            message: "Access denied. No token provided.",
          });
      }

      let decoded;
      try {
        // Try verifying the access token
        decoded = jwt.verify(token, process.env.TOKEN_SECRET);
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          console.log("🔄 Access token expired. Attempting refresh...");

          const refreshToken = req.cookies.RefreshToken;
          if (!refreshToken) {
            return res
              .status(401)
              .json({
                success: false,
                message: "Session expired. Please log in again.",
              });
          }

          try {
            // Verify refresh token
            const decodedRefresh = jwt.verify(
              refreshToken,
              process.env.REFRESH_TOKEN_SECRET
            );

            // Generate new access token
            token = jwt.sign(
              {
                userId: decodedRefresh.userId,
                email: decodedRefresh.email,
                role: decodedRefresh.role,
              },
              process.env.TOKEN_SECRET,
              { expiresIn: "8h" }
            );

            // Update access token in cookies
            res.cookie("Authorization", "Bearer " + token, {
              expires: new Date(Date.now() + 8 * 3600000), // 8 hours
              httpOnly: process.env.NODE_ENV === "production",
              secure: process.env.NODE_ENV === "production",
            });

            decoded = jwt.verify(token, process.env.TOKEN_SECRET);
          } catch (refreshError) {
            return res
              .status(403)
              .json({ success: false, message: "Invalid refresh token." });
          }
        } else {
          return res
            .status(403)
            .json({ success: false, message: "Invalid token." });
        }
      }

      // Fetch user from database
      const user = await User.findById(decoded.userId);
      if (!user || !allowedRoles.includes(user.role)) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Access denied. You do not have permission.",
          });
      }

      // Attach user to request object
      req.user = user;
      console.log("✅ Access Granted:", user.role);

      next();
    } catch (error) {
      console.log("❌ Role Middleware Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };
};

module.exports = roleMiddleware;
