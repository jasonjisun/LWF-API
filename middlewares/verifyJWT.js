const User = require("../models/usersModel");
const getAccessToken = require("../utils/getTokenFromRequest");
const {
  verifyToken,
  verifyRefreshToken,
  generateAccessToken,
} = require("../utils/tokenUtils");

const verifyJWT = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      let token = getAccessToken(req);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "No token provided.",
        });
      }

      let decoded;

      try {
        decoded = verifyToken(token, process.env.TOKEN_SECRET);
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          const refreshToken = req.cookies.RefreshToken;

          if (!refreshToken) {
            return res.status(401).json({
              success: false,
              message: "Session expired. Please log in again.",
            });
          }

          try {
            const decodedRefresh = verifyRefreshToken(refreshToken);
            token = generateAccessToken(decodedRefresh);

            res.cookie("Authorization", `Bearer ${token}`, {
              expires: new Date(Date.now() + 8 * 3600000),
              httpOnly: process.env.NODE_ENV === "production",
              secure: process.env.NODE_ENV === "production",
            });

            decoded = verifyToken(token, process.env.TOKEN_SECRET);

            const user = await User.findById(decoded.userId);
            if (!user) {
              return res.status(404).json({
                success: false,
                message: "User not found.",
              });
            }

            if (allowedRoles.length && !allowedRoles.includes(user.role)) {
              return res.status(403).json({
                success: false,
                message: "Access denied. Unauthorized role.",
              });
            }

            req.user = user;
            req.token = token;
            return next(); // ✅ Important: end the refresh block here
          } catch {
            return res.status(403).json({
              success: false,
              message: "Invalid refresh token.",
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            message: "Invalid token.",
          });
        }
      }

      // Token is valid (not expired)
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Unauthorized role.",
        });
      }

      req.user = user;
      req.token = token;
      next();
    } catch (error) {
      console.error("JWT Middleware Error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  };
};

module.exports = verifyJWT;
