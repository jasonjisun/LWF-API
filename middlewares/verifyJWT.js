const jwt = require("jsonwebtoken");
const User = require("../models/usersModel");

const verifyJWT = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // 1. Extract token from header or cookies
      let token;
      if (req.headers.client === "not-browser") {
        token = req.headers.authorization?.split(" ")[1];
      } else {
        token = req.cookies.Authorization?.split("Bearer ")[1];
      }

      if (!token) {
        return res.status(401).json({ success: false, message: "No token provided." });
      }

      let decoded;

      try {
        // 2. Try to verify access token
        decoded = jwt.verify(token, process.env.TOKEN_SECRET);
      } catch (err) {
        // 3. If expired, attempt refresh token flow
        if (err.name === "TokenExpiredError") {
          const refreshToken = req.cookies.RefreshToken;

          if (!refreshToken) {
            return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
          }

          try {
            const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

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

            // Set new access token in cookies
            res.cookie("Authorization", `Bearer ${token}`, {
              expires: new Date(Date.now() + 8 * 3600000),
              httpOnly: process.env.NODE_ENV === "production",
              secure: process.env.NODE_ENV === "production",
            });

            decoded = jwt.verify(token, process.env.TOKEN_SECRET);
          } catch (refreshError) {
            return res.status(403).json({ success: false, message: "Invalid refresh token." });
          }
        } else {
          return res.status(403).json({ success: false, message: "Invalid token." });
        }
      }

      // 4. Fetch user and check role
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ success: false, message: "Access denied. Unauthorized role." });
      }

      // 5. Attach user info to request
      req.user = user;
      req.token = token;

      next();
    } catch (error) {
      console.error("JWT Middleware Error:", error);
      res.status(500).json({ success: false, message: "Internal server error." });
    }
  };
};

module.exports = verifyJWT;
