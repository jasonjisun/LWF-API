const express = require("express");
const passport = require("passport");
const authController = require("../controllers/authController");
const { identifier } = require("../middlewares/identifier");
const router = express.Router();
const authenticate = require("../middlewares/authMiddleware");
const { loginSuccess, loginFailure, logoutUser } = require("../controllers/authController");

router.post("/signup", authController.signup);  // This will now correctly call the signup method
router.post("/signin", authController.signin);  // Ensure signin method is correct
router.post("/signout", authController.signout);
router.post("/refresh-token", identifier, authController.refreshToken);
router.post("/send-verification-code", authController.sendVerificationCode);

router.patch("/verify-verification-code", identifier, authController.verifyVerificationCode);
router.put("/change-password", authenticate, authController.changePassword);  // Use `authenticate` middleware here
router.patch("/send-forgot-password-code", authController.sendForgotPasswordCode);
router.patch("/verify-forgot-password-code", authController.verifyForgotPasswordCode);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/auth/login/failure" }), (req, res) => {
  const token = req.user.token;
  const role = req.user.role;
  res.redirect(`http://localhost:5173/google-auth?token=${token}&role=${role}`);
});

router.get("/login/success", loginSuccess);
router.get("/login/failure", loginFailure);
router.get("/google/logout", logoutUser);

module.exports = router;
