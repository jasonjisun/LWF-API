const jwt = require("jsonwebtoken");
const {
  signupSchema,
  signinSchema,
  acceptCodeSchema,
  changePasswordSchema,
  acceptFPCodeSchema,
} = require("../middlewares/validator");
const User = require("../models/usersModel");
const { doHash, doHashValidation, hmacProcess } = require("../utils/hashing");
const transport = require("../middlewares/sendMail");
const EMR = require("../models/emrModel");
const VALID_ROLES = ["admin", "doctor", "patient"];
const Log = require("../models/logsModel"); // Import the Log model

// 📌 Signup (Register a New User)
exports.signup = async (req, res) => {
  const { email, password, confirmPassword, role } = req.body;

  try {
    // Validate input
    const { error } = signupSchema.validate({ email, password, confirmPassword });
    if (error) {
      await Log.create({
        action: 'SIGNUP_FAILED_VALIDATION',
        email,
        role: role || 'patient',
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(401).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await Log.create({
        action: 'SIGNUP_FAILED_DUPLICATE',
        email,
        role: existingUser.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(401).json({
        success: false,
        message: "User already exists!"
      });
    }

    // Assign default role
    const assignedRole = role && VALID_ROLES.includes(role) ? role : "patient";

    // Hash password
    const hashedPassword = await doHash(password, 12);

    // Create new user
    const newUser = new User({ email, password: hashedPassword, role: assignedRole });
    await newUser.save();

    // If patient, create empty EMR
    if (assignedRole === "patient") {
      const emptyEMR = new EMR({
        userId: newUser._id,
        name: "",
        dob: null,
        age: null,
        gender: "",
        bloodType: "",
        contact: "",
        email: newUser.email,
        address: "",
        allergies: [],
        conditions: [],
        medications: [],
        visitHistory: [],
      });
      await emptyEMR.save();
    }

    // ✅ Success log
    await Log.create({
      action: 'USER_SIGNUP_SUCCESS',
      email,
      role: assignedRole,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(201).json({
      success: true,
      message: "Your account has been created successfully!",
      role: newUser.role,
    });
  } catch (error) {
    console.error("Signup Error:", error);

    // ❌ Server error log
    await Log.create({
      action: 'SIGNUP_ERROR',
      email,
      role: role || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


exports.signin = async (req, res) => {
  const { email, password, rememberMe } = req.body;

  try {
    // Validate input
    const { error } = signinSchema.validate({ email, password });
    if (error) {
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });
    }

    // Find user
    const existingUser = await User.findOne({ email }).select("+password");
    if (!existingUser) {
      return res
        .status(401)
        .json({ success: false, message: "User does not exist!" });
    }

    // Validate password
    const isPasswordValid = await doHashValidation(
      password,
      existingUser.password
    );
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials!" });
    }

    // Set token expiration based on "Remember Me"
    const accessTokenExpiry = "8h"; 
    const refreshTokenExpiry = rememberMe ? "30d" : "7d";

    // Generate Access Token
    const token = jwt.sign(
      {
        userId: existingUser._id,
        email: existingUser.email,
        role: existingUser.role,
        verified: existingUser.verified,
      },
      process.env.TOKEN_SECRET,
      { expiresIn: accessTokenExpiry }
    );

    // Generate Refresh Token
    const refreshToken = jwt.sign(
      { userId: existingUser._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: refreshTokenExpiry }
    );

    // ✅ Create audit log
    try {
      await Log.create({
        action: 'USER_LOGIN',
        role: existingUser.role,
        email: existingUser.email,
        ip: req.ip,
        endpoint: req.originalUrl
      });
    } catch (logErr) {
      console.error('Failed to log login event:', logErr.message);
    }

    // Set cookies with different lifetimes
    res
      .cookie("Authorization", "Bearer " + token, {
        expires: new Date(Date.now() + 8 * 3600000), // 8 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
      })
      .cookie("RefreshToken", refreshToken, {
        expires: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 3600000),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
      })
      .cookie("UserID", existingUser._id.toString(), {
        expires: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 3600000),
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
      })
      .json({
        success: true,
        token,
        refreshToken,
        role: existingUser.role,
        userId: existingUser._id,
        message: "Logged in successfully!",
      });

  } catch (error) {
    console.log("Signin Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.refreshToken = async (req, res) => {
  const refreshToken = req.cookies.RefreshToken; // 🟢 Read refresh token from cookie

  if (!refreshToken) {
    return res
      .status(403)
      .json({ success: false, message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const newToken = jwt.sign(
      { userId: decoded.userId },
      process.env.TOKEN_SECRET,
      { expiresIn: "8h" }
    );

    res
      .cookie("Authorization", "Bearer " + newToken, {
        expires: new Date(Date.now() + 8 * 3600000), // New access token lasts 8 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      })
      .json({ success: true, token: newToken });
  } catch (error) {
    res.status(403).json({ success: false, message: "Invalid refresh token" });
  }
};

exports.signout = async (req, res) => {
  try {
    // ✅ Log the action
    await Log.create({
      action: 'USER_SIGNOUT',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl
    });
    res
      .clearCookie("Authorization", { httpOnly: true, secure: true, sameSite: "None" })
      .clearCookie("RefreshToken", { httpOnly: true, secure: true, sameSite: "None" })
      .clearCookie("UserID", { httpOnly: false, secure: true, sameSite: "None" })
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Signout Logging Error:", error);
    res.status(500).json({ success: false, message: "Error during logout" });
  }
};

exports.sendVerificationCode = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const email = req.user.email;
    const role = req.user.role;

    // Find user by email
    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      await Log.create({
        action: 'VERIFICATION_FAILED_NO_USER',
        email,
        role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(404).json({ success: false, message: "User does not exist!" });
    }

    // Check if already verified
    if (existingUser.verified) {
      await Log.create({
        action: 'VERIFICATION_SKIPPED_ALREADY_VERIFIED',
        email,
        role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(400).json({ success: false, message: "You are already verified!" });
    }

    // Generate a verification code
    const codeValue = Math.floor(Math.random() * 1000000).toString();

    // Send the email with the verification code
    let info = await transport.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
      to: existingUser.email,
      subject: "Verification Code",
      html: `<h1>${codeValue}</h1>`,
    });

    if (info.accepted[0] === existingUser.email) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE_SECRET
      );

      // Store the verification code and timestamp in the database
      existingUser.verificationCode = hashedCodeValue;
      existingUser.verificationCodeValidation = Date.now();
      await existingUser.save();

      await Log.create({
        action: 'VERIFICATION_CODE_SENT',
        email,
        role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(200).json({ success: true, message: "Code sent!" });
    }

    await Log.create({
      action: 'VERIFICATION_CODE_FAILED_SEND',
      email,
      role,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(400).json({ success: false, message: "Code send failed!" });

  } catch (error) {
    console.log(error);

    await Log.create({
      action: 'VERIFICATION_CODE_ERROR',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.verifyVerificationCode = async (req, res) => {
  try {
    const email = req.user.email;
    const { providedCode } = req.body;

    // Validate provided code only
    const { error } = acceptCodeSchema.validate({ providedCode });
    if (error) {
      await Log.create({
        action: 'VERIFICATION_FAILED_INVALID_INPUT',
        email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const codeValue = providedCode.toString();
    const existingUser = await User.findOne({ email }).select(
      "+verificationCode +verificationCodeValidation"
    );

    if (!existingUser) {
      await Log.create({
        action: 'VERIFICATION_FAILED_NO_USER',
        email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });
      return res.status(404).json({ success: false, message: "User does not exist!" });
    }

    if (existingUser.verified) {
      await Log.create({
        action: 'VERIFICATION_SKIPPED_ALREADY_VERIFIED',
        email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });
      return res.status(400).json({ success: false, message: "You are already verified!" });
    }

    if (!existingUser.verificationCode || !existingUser.verificationCodeValidation) {
      await Log.create({
        action: 'VERIFICATION_FAILED_INVALID_CODE',
        email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });
      return res.status(400).json({ success: false, message: "Something is wrong with the code!" });
    }

    if (Date.now() - existingUser.verificationCodeValidation > 5 * 60 * 1000) {
      await Log.create({
        action: 'VERIFICATION_FAILED_CODE_EXPIRED',
        email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });
      return res.status(400).json({ success: false, message: "Code has expired!" });
    }

    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE_SECRET
    );

    if (hashedCodeValue === existingUser.verificationCode) {
      existingUser.verified = true;
      existingUser.verificationCode = undefined;
      existingUser.verificationCodeValidation = undefined;

      await existingUser.save();

      await Log.create({
        action: 'VERIFICATION_SUCCESSFUL',
        email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(200).json({ success: true, message: "Your account has been verified!" });
    }

    await Log.create({
      action: 'VERIFICATION_FAILED_INVALID_CODE',
      email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    return res.status(400).json({ success: false, message: "Invalid code!" });
  } catch (error) {
    console.error(error);

    await Log.create({
      action: 'VERIFICATION_CODE_ERROR',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.changePassword = async (req, res) => {
  // Destructure the userId and verified correctly from req.user
  const userId = req.user._id || req.user.id;  // Use _id or id (depending on your schema)
  const verified = req.user.verified;

  const { oldPassword, newPassword, confirmNewPassword } = req.body;

  try {
    // Validate passwords using your schema
    const { error } = changePasswordSchema.validate({
      oldPassword,
      newPassword,
      confirmNewPassword,
    });

    if (error) {
      // Log invalid input
      await Log.create({
        action: 'PASSWORD_CHANGE_FAILED_INVALID_INPUT',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(401).json({ success: false, message: error.details[0].message });
    }

    // Check if user is verified
    if (!verified) {
      // Log unverified user
      await Log.create({
        action: 'PASSWORD_CHANGE_FAILED_UNVERIFIED_USER',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(401).json({ success: false, message: "You are not a verified user!" });
    }

    // Find the user based on userId
    const existingUser = await User.findOne({ _id: userId }).select("+password");
    if (!existingUser) {
      // Log missing user
      await Log.create({
        action: 'PASSWORD_CHANGE_FAILED_NO_USER',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(401).json({ success: false, message: "User does not exist!" });
    }

    // Validate the old password
    const isOldPasswordValid = await doHashValidation(oldPassword, existingUser.password);
    if (!isOldPasswordValid) {
      // Log invalid old password
      await Log.create({
        action: 'PASSWORD_CHANGE_FAILED_INVALID_OLD_PASSWORD',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(401).json({ success: false, message: "Invalid current password!" });
    }

    // Ensure the new password is different from the old password
    if (oldPassword === newPassword) {
      // Log new password is the same as old password
      await Log.create({
        action: 'PASSWORD_CHANGE_FAILED_SAME_AS_OLD_PASSWORD',
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(400).json({
        success: false,
        message: "New password must be different from the old password!",
      });
    }

    // Hash the new password
    const hashedPassword = await doHash(newPassword, 12);
    existingUser.password = hashedPassword;

    // Save the updated user document
    await existingUser.save();

    // Log successful password change
    await Log.create({
      action: 'PASSWORD_CHANGE_SUCCESS',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    return res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    console.error("Error changing password:", error);

    // Log server error
    await Log.create({
      action: 'PASSWORD_CHANGE_FAILED_SERVER_ERROR',
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.sendForgotPasswordCode = async (req, res) => {
  const { email } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      // Log: User does not exist
      await Log.create({
        action: 'FORGOT_PASSWORD_CODE_FAILED_USER_NOT_FOUND',
        email: email,
        role: 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res
        .status(404)
        .json({ success: false, message: "User does not exist!" });
    }

    const codeValue = Math.floor(Math.random() * 1000000).toString();
    let info = await transport.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
      to: existingUser.email,
      subject: "Forgot password code",
      html: "<h1>" + codeValue + "</h1>",
    });

    if (info.accepted[0] === existingUser.email) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE_SECRET
      );
      existingUser.forgotPasswordCode = hashedCodeValue;
      existingUser.forgotPasswordCodeValidation = Date.now();
      await existingUser.save();

      // Log: Code successfully sent
      await Log.create({
        action: 'FORGOT_PASSWORD_CODE_SENT',
        email: existingUser.email,
        role: existingUser.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res.status(200).json({ success: true, message: "Code sent!" });
    }

    // Log: Code sending failed
    await Log.create({
      action: 'FORGOT_PASSWORD_CODE_SEND_FAILED',
      email: existingUser.email,
      role: existingUser.role,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(400).json({ success: false, message: "Code send failed!" });
  } catch (error) {
    console.log(error);

    // Log: Error during the process
    await Log.create({
      action: 'FORGOT_PASSWORD_CODE_FAILED_SERVER_ERROR',
      email: email,
      role: 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.verifyForgotPasswordCode = async (req, res) => {
  const { email, providedCode, newPassword } = req.body;
  try {
    const { error, value } = acceptFPCodeSchema.validate({
      email,
      providedCode,
      newPassword,
    });
    if (error) {
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });
    }

    const codeValue = providedCode.toString();
    const existingUser = await User.findOne({ email }).select(
      "+forgotPasswordCode +forgotPasswordCodeValidation"
    );

    if (!existingUser) {
      // Log: User not found
      await Log.create({
        action: 'FORGOT_PASSWORD_CODE_FAILED_USER_NOT_FOUND',
        email: email,
        role: 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res
        .status(401)
        .json({ success: false, message: "User does not exist!" });
    }

    if (
      !existingUser.forgotPasswordCode ||
      !existingUser.forgotPasswordCodeValidation
    ) {
      // Log: Code validation failure (empty or invalid code)
      await Log.create({
        action: 'FORGOT_PASSWORD_CODE_INVALID',
        email: email,
        role: existingUser.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res
        .status(400)
        .json({ success: false, message: "Something is wrong with the code!" });
    }

    if (
      Date.now() - existingUser.forgotPasswordCodeValidation >
      5 * 60 * 1000
    ) {
      // Log: Code expired
      await Log.create({
        action: 'FORGOT_PASSWORD_CODE_EXPIRED',
        email: email,
        role: existingUser.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res
        .status(400)
        .json({ success: false, message: "Code has expired!" });
    }

    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE_SECRET
    );

    if (hashedCodeValue === existingUser.forgotPasswordCode) {
      const hashedPassword = await doHash(newPassword, 12);
      existingUser.password = hashedPassword;
      existingUser.forgotPasswordCode = undefined;
      existingUser.forgotPasswordCodeValidation = undefined;
      await existingUser.save();

      // Log: Password updated successfully
      await Log.create({
        action: 'FORGOT_PASSWORD_PASSWORD_UPDATED',
        email: email,
        role: existingUser.role,
        ip: req.ip,
        endpoint: req.originalUrl
      });

      return res
        .status(200)
        .json({ success: true, message: "Password updated successfully!" });
    }

    // Log: Code mismatch (unexpected error)
    await Log.create({
      action: 'FORGOT_PASSWORD_CODE_MISMATCH',
      email: email,
      role: 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl
    });

    return res
      .status(400)
      .json({ success: false, message: "Unexpected error occurred!" });
  } catch (error) {
    console.log(error);

    // Log: Server error
    await Log.create({
      action: 'FORGOT_PASSWORD_FAILED_SERVER_ERROR',
      email: email,
      role: 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.loginSuccess = async (req, res) => {
  if (req.user) {
    // Log successful login
    await Log.create({
      action: 'USER_LOGIN_SUCCESS',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(200).json({
      success: true,
      message: "Successfully logged in",
      user: req.user,
    });
  } else {
    // Log failed login due to no user
    await Log.create({
      action: 'USER_LOGIN_FAILED',
      email: 'unknown',
      role: 'unknown',
      ip: req.ip,
      endpoint: req.originalUrl
    });

    res.status(401).json({ success: false, message: "Not authenticated" });
  }
};

exports.loginFailure = async (req, res) => {
  // Log failed login attempt
  await Log.create({
    action: 'USER_LOGIN_FAILED',
    email: req.body.email || 'unknown',
    role: 'unknown',
    ip: req.ip,
    endpoint: req.originalUrl
  });

  res.status(401).json({ success: false, message: "Login failed" });
};

exports.logoutUser = async (req, res) => {
  const email = req.user ? req.user.email : 'unknown'; // Check if user is logged in

  // Log logout action
  await Log.create({
    action: 'USER_LOGOUT',
    email: email,
    role: req.user ? req.user.role : 'unknown',
    ip: req.ip,
    endpoint: req.originalUrl
  });

  req.logout(() => {
    res.status(200).json({ success: true, message: "Logged out successfully" });
  });
};