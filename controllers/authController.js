const authService = require("../services/authService");
const { signupSchema, signinSchema, changePasswordSchema, acceptFPCodeSchema } = require("../middlewares/validator");
const successHandler = require("../utils/successHandler");
const errorHandler = require("../utils/errorHandler");

exports.signup = async (req, res) => {
  const { error } = signupSchema.validate(req.body);
  if (error) return errorHandler(res, { status: 400, message: error.details.map(err => err.message).join(", ") });

  try {
    const result = await authService.signup(req.body);
    successHandler(res, result);
  } catch (err) {
    errorHandler(res, { status: 500, message: "Signup failed, please try again." });
  }
};

exports.signin = async (req, res) => {
  const { email, password, rememberMe } = req.body;  

  try {
    // Call authService to validate the user credentials and generate the tokens
    const result = await authService.signin({ email, password, rememberMe });

    if (result.success) {
      // Define expiration times for the cookies (use longer expiration for refresh token)
      const accessTokenExpiration = "1h"; // Access token expires in 1 hour
      const refreshTokenExpiration = rememberMe ? "7d" : "1d"; // Refresh token expires in 7 days if rememberMe is true, else 1 day

      res.cookie("Authorization", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',  // Set secure flag for production
        maxAge: 1000 * 60 * 60, // 1 hour expiration for the access token
        sameSite: 'Strict',  // Prevent CSRF by setting SameSite to Strict
      });

      res.cookie("RefreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Set secure flag for production
        maxAge: rememberMe ? 1000 * 60 * 60 * 24 * 7 : 1000 * 60 * 60 * 24, // Set refresh token expiration based on rememberMe
        sameSite: 'Strict',  // Prevent CSRF by setting SameSite to Strict
      });

      // Return the success response with the result from authService
      successHandler(res, result);
    } else {
      // Return error if authentication failed
      errorHandler(res, { status: result.status, message: result.message });
    }
  } catch (err) {
    // Catch any unexpected errors and return an internal server error
    console.error("Signin Error:", err.message);
    errorHandler(res, { status: 500, message: "Signin failed. Please try again." });
  }
};


exports.refreshToken = async (req, res) => {
  const token = req.cookies.RefreshToken;

  if (!token) {
    return errorHandler(res, { status: 403, message: "No refresh token provided." });
  }

  try {
    const result = await authService.refreshToken(token);

    // If the refresh token is valid, send the new access token
    if (result.success) {
      return successHandler(res, result);  // Returns the new token to the client
    }

    // If something went wrong in the service, handle the error
    return errorHandler(res, { status: result.status, message: result.message });
  } catch (err) {
    console.error("Error refreshing token:", err.message);
    return errorHandler(res, { status: 500, message: "Internal server error." });
  }
};

exports.signout = async (req, res) => {
  try {
    res.clearCookie("Authorization");
    res.clearCookie("RefreshToken");
    successHandler(res, { message: "Logged out successfully." });
  } catch (err) {
    errorHandler(res, { status: 500, message: "Internal server error." });
  }
};

exports.sendVerificationCode = async (req, res) => {
  const { email } = req.body;

  try {
    const result = await authService.sendVerificationCode(email);
    result.success ? successHandler(res, result) : errorHandler(res, result);
  } catch (err) {
    errorHandler(res, { status: 500, message: "Internal server error." });
  }
};

exports.verifyVerificationCode = async (req, res) => {
  const { email, providedCode } = req.body;

  try {
    const result = await authService.verifyVerificationCode({ email, providedCode });
    result.success ? successHandler(res, result) : errorHandler(res, result);
  } catch (err) {
    errorHandler(res, { status: 500, message: "Internal server error." });
  }
};

exports.changePassword = async (req, res) => {
  const { userId, verified } = req.user; // This will now have the userId and verified fields
  const { oldPassword, newPassword, confirmNewPassword } = req.body;

  if (newPassword !== confirmNewPassword) return errorHandler(res, { status: 400, message: "Passwords do not match." });
  if (newPassword.length < 8) return errorHandler(res, { status: 400, message: "Password must be at least 8 characters long." });

  try {
    const result = await authService.changePassword({ userId, verified }, { oldPassword, newPassword });
    successHandler(res, result);
  } catch (error) {
    errorHandler(res, { status: 500, message: "Internal server error" });
  }
};


exports.sendForgotPasswordCode = async (req, res) => {
  try {
    const result = await authService.sendForgotPasswordCode(req.body.email);
    successHandler(res, result);
  } catch (error) {
    errorHandler(res, { status: 500, message: "Internal server error" });
  }
};

exports.verifyForgotPasswordCode = async (req, res) => {
  try {
    const { email, providedCode, newPassword } = req.body;
    const result = await authService.verifyForgotPasswordCode({ email, providedCode, newPassword });
    successHandler(res, result);
  } catch (error) {
    errorHandler(res, { status: 500, message: "Internal server error" });
  }
};

exports.loginSuccess = (req, res) => {
  if (req.user) {
    successHandler(res, { message: "Successfully logged in", user: req.user });
  } else {
    errorHandler(res, { status: 401, message: "Not authenticated" });
  }
};

exports.loginFailure = (req, res) => {
  errorHandler(res, { status: 401, message: "Login failed" });
};

exports.logoutUser = (req, res) => {
  req.logout((err) => {
    if (err) {
      return errorHandler(res, { status: 500, message: "Failed to log out" });
    }
    successHandler(res, { message: "Logged out successfully" });
  });
};
