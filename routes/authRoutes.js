const express = require("express");
const passport = require("passport");
const authController = require("../controllers/authController");
const { identifier } = require("../middlewares/identification");
const router = express.Router();
const {
  loginSuccess,
  loginFailure,
  logoutUser,
} = require("../controllers/authController");

router.post("/signup", authController.signup);
router.post("/signin", authController.signin);
router.post("/signout", identifier, authController.signout);
router.post("/refresh-token", identifier, authController.refreshToken);

router.patch(
  "/send-verification-code",
  identifier,
  authController.sendVerificationCode
);
router.patch(
  "/verify-verification-code",
  identifier,
  authController.verifyVerificationCode
);
router.patch("/change-password", identifier, authController.changePassword);
router.patch(
  "/send-forgot-password-code",
  authController.sendForgotPasswordCode
);
router.patch(
  "/verify-forgot-password-code",
  authController.verifyForgotPasswordCode
);

// 🟢 Start Google OAuth flow
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// 🟢 Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/login/failure" }),
  (req, res) => {
    res.redirect("/auth/login/success"); // Redirect to success page after login
  }
);

// 🟢 Login success route
router.get("/login/success", loginSuccess);

// 🔴 Login failure route
router.get("/login/failure", loginFailure);

// 🟢 Logout route
router.get("/google/logout", logoutUser);

module.exports = router;
