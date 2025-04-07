const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { doHash, doHashValidation, hmacProcess } = require("../utils/hashing");
const transport = require("../middlewares/sendMail");
const {
  signupSchema,
  signinSchema,
  acceptCodeSchema,
  changePasswordSchema,
  acceptFPCodeSchema,
} = require("../middlewares/validator");
const VALID_ROLES = ["admin", "doctor", "patient"];

// 📌 Signup (Register a New User)
exports.signup = async ({ email, password, confirmPassword, role }) => {
  try {
    // Validate input using Joi
    const { error } = signupSchema.validate({ email, password, confirmPassword });
    if (error) {
      return { success: false, status: 400, message: error.details.map((err) => err.message).join(", ") };
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return { success: false, status: 409, message: "Email already in use." };
    }

    // Hash the password
    const hashedPassword = await doHash(password, 12);

    // Ensure that the role is valid (admin, doctor, or patient)
    if (!VALID_ROLES.includes(role)) {
      return { success: false, status: 400, message: "Invalid role specified." };
    }

    // Create a new user
    const user = await User.create({
      email,
      password: hashedPassword,
      role,  // Ensure the role passed from the request body is used here
    });

    return {
      success: true,
      status: 201,
      message: "Account created successfully!",
      role: user.role,
    };
  } catch (err) {
    console.error("Signup Error:", err.message);
    return { success: false, status: 500, message: "Signup failed. Please try again." };
  }
};

// 📌 Signin (Login)
exports.signin = async ({ email, password, rememberMe }) => {
  try {
    // Fetch user with the email and include the password field for validation
    const user = await User.findOne({ email }).select("+password");

    // Return error if the user doesn't exist
    if (!user) {
      return { success: false, status: 401, message: "Invalid email or password." };
    }

    // Validate the provided password with the stored hashed password
    const valid = await doHashValidation(password, user.password);
    if (!valid) {
      return { success: false, status: 401, message: "Invalid email or password." };
    }

    // Generate the access token with an expiration time of 8 hours
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role, verified: user.verified },
      process.env.TOKEN_SECRET,
      { expiresIn: "8h" }
    );
    
    console.log("Generated Token:", token);  // Log the generated token
    console.log("Signing with TOKEN_SECRET:", process.env.TOKEN_SECRET);  // Log the signing secret
    

    // Generate the refresh token with expiration based on rememberMe flag
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: rememberMe ? "30d" : "7d" }  // 30 days if rememberMe, else 7 days
    );

    // Return the success response with the tokens and user role
    return {
      success: true,
      status: 200,
      message: "Logged in successfully!",
      token,
      refreshToken,
      role: user.role,
    };
  } catch (err) {
    // Log the error message for debugging purposes
    console.error("Signin:", err.message);

    // Return generic error message in case of an internal server error
    return { success: false, status: 500, message: "Signin failed. Please try again." };
  }
};

// 📌 Refresh Token
exports.refreshToken = async (refreshToken) => {
  try {
    if (!refreshToken) {
      return { success: false, status: 403, message: "No refresh token provided." };
    }

    // Verify the refresh token and extract userId from it
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // If verification is successful, create a new access token
    const newToken = jwt.sign(
      { userId: decoded.userId },  // Use decoded userId
      process.env.TOKEN_SECRET,
      { expiresIn: "8h" }  // New token expires in 8 hours
    );

    return { success: true, status: 200, token: newToken };
  } catch (err) {
    console.error("RefreshToken Error:", err.message);

    // Handle cases like expired or invalid tokens
    return { success: false, status: 403, message: "Invalid or expired refresh token." };
  }
};

// 📌 Signout
exports.signout = () => ({ success: true, message: "Logged out successfully." });

// 📌 Send Verification Code
exports.sendVerificationCode = async (email) => {
  try {
    const existingUser = await User.findOne({ email });

    if (!existingUser)
      return { success: false, status: 404, message: "User does not exist!" };

    if (existingUser.verified)
      return { success: false, status: 400, message: "You are already verified!" };

    const codeValue = Math.floor(Math.random() * 1000000).toString();

    let info = await transport.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
      to: existingUser.email,
      subject: "Verification Code",
      html: `<h1>${codeValue}</h1>`,
    });

    if (info.accepted.includes(existingUser.email)) {
      const hashedCode = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE_SECRET);
      existingUser.verificationCode = hashedCode;
      existingUser.verificationCodeValidation = Date.now();
      await existingUser.save();

      return { success: true, status: 200, message: "Code sent!" };
    }

    return { success: false, status: 400, message: "Code sending failed!" };
  } catch (error) {
    console.error("Verification Code Error:", error.message);
    return { success: false, status: 500, message: "Internal server error" };
  }
};



// 📌 Verify Verification Code
exports.verifyVerificationCode = async ({ email, providedCode }) => {
  try {
    const existingUser = await User.findOne({ email }).select("+verificationCode +verificationCodeValidation");

    if (!existingUser) return { success: false, status: 404, message: "User does not exist!" };
    if (existingUser.verified) return { success: false, status: 400, message: "You are already verified!" };
    if (!existingUser.verificationCode || !existingUser.verificationCodeValidation) 
      return { success: false, status: 400, message: "Something is wrong with the code!" };
    
    const isExpired = Date.now() - existingUser.verificationCodeValidation > 5 * 60 * 1000;
    if (isExpired) return { success: false, status: 400, message: "Code has expired!" };

    const hashedCode = hmacProcess(providedCode.toString(), process.env.HMAC_VERIFICATION_CODE_SECRET);

    if (hashedCode === existingUser.verificationCode) {
      existingUser.verified = true;
      existingUser.verificationCode = undefined;
      existingUser.verificationCodeValidation = undefined;
      await existingUser.save();
      return { success: true, status: 200, message: "Your account has been verified!" };
    }

    return { success: false, status: 400, message: "Invalid verification code!" };
  } catch (error) {
    console.error("Verification Code Verification Error:", error.message);
    return { success: false, status: 500, message: "Internal server error" };
  }
};


// 📌 Change Password
exports.changePassword = async ({ userId, verified }, { oldPassword, newPassword }) => {
  try {
    if (!verified) {
      return { success: false, status: 401, message: "You are not a verified user!" };
    }

    const existingUser = await User.findOne({ _id: userId }).select("+password");
    if (!existingUser) {
      return { success: false, status: 401, message: "User does not exist!" };
    }

    // Validate old password
    const isOldPasswordValid = await doHashValidation(oldPassword, existingUser.password);
    if (!isOldPasswordValid) {
      return { success: false, status: 401, message: "Invalid current password!" };
    }

    // Check if new password is different from the old password
    if (oldPassword === newPassword) {
      return { success: false, status: 400, message: "New password must be different from the old password!" };
    }

    // Hash and update new password
    existingUser.password = await doHash(newPassword, 12);
    await existingUser.save();

    return { success: true, status: 200, message: "Password updated successfully!" };
  } catch (error) {
    console.error("Error changing password:", error);
    return { success: false, status: 500, message: "Internal server error" };
  }
};



// 📌 Send Forgot Password Code
exports.sendForgotPasswordCode = async (email) => {
  try {
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return { success: false, status: 404, message: "User does not exist!" };
    }

    const codeValue = Math.floor(Math.random() * 1000000).toString();
    const info = await transport.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
      to: existingUser.email,
      subject: "Forgot password code",
      html: `<h1>${codeValue}</h1>`,
    });

    if (info.accepted.includes(existingUser.email)) {
      const hashedCodeValue = hmacProcess(codeValue, process.env.HMAC_VERIFICATION_CODE_SECRET);
      existingUser.forgotPasswordCode = hashedCodeValue;
      existingUser.forgotPasswordCodeValidation = Date.now();
      await existingUser.save();
      return { success: true, status: 200, message: "Code sent!" };
    }
    return { success: false, status: 400, message: "Code sending failed!" };
  } catch (error) {
    console.error(error);
    return { success: false, status: 500, message: "Internal server error" };
  }
};


// 📌 Verify Forgot Password Code
exports.verifyForgotPasswordCode = async ({ email, providedCode, newPassword }) => {
  try {
    const existingUser = await User.findOne({ email }).select("+forgotPasswordCode +forgotPasswordCodeValidation");

    if (!existingUser) return { success: false, status: 401, message: "User does not exist!" };
    if (!existingUser.forgotPasswordCode || !existingUser.forgotPasswordCodeValidation) {
      return { success: false, status: 400, message: "Something is wrong with the code!" };
    }
    if (Date.now() - existingUser.forgotPasswordCodeValidation > 5 * 60 * 1000) {
      return { success: false, status: 400, message: "Code has expired!" };
    }

    const hashedCodeValue = hmacProcess(providedCode, process.env.HMAC_VERIFICATION_CODE_SECRET);
    if (hashedCodeValue === existingUser.forgotPasswordCode) {
      existingUser.password = await doHash(newPassword, 12);
      existingUser.forgotPasswordCode = undefined;
      existingUser.forgotPasswordCodeValidation = undefined;
      await existingUser.save();

      return { success: true, status: 200, message: "Password updated successfully!" };
    }
    return { success: false, status: 400, message: "Invalid code!" };
  } catch (error) {
    console.error(error);
    return { success: false, status: 500, message: "Internal server error" };
  }
};

