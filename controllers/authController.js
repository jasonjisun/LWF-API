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

// 📌 Signup (Register a New User)
const EMR = require("../models/EMR"); // Add this at the top

exports.signup = async (req, res) => {
  const { email, password, confirmPassword, role } = req.body;

  try {
    // Validate input
    const { error } = signupSchema.validate({ email, password, confirmPassword });
    if (error) {
      return res.status(401).json({ success: false, message: error.details[0].message });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(401).json({ success: false, message: "User already exists!" });
    }

    // Assign "patient" as the default role if not provided
    const assignedRole = role && VALID_ROLES.includes(role) ? role : "patient";

    // Hash password
    const hashedPassword = await doHash(password, 12);

    // Create new user
    const newUser = new User({ email, password: hashedPassword, role: assignedRole });
    await newUser.save();

    // If the user is a patient, create an empty EMR
    if (assignedRole === "patient") {
      const emptyEMR = new EMR({
        userId: newUser._id,
        name: "",
        dob: null,
        age: null,
        gender: "",
        bloodType: "",
        contact: "",
        email: "",
        address: "",
        allergies: [],
        conditions: [],
        medications: [],
        visitHistory: [],
      });

      await emptyEMR.save();
    }

    res.status(201).json({
      success: true,
      message: "Your account has been created successfully!",
      role: newUser.role,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// 📌 Signin (Login)
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
  res
    .clearCookie("Authorization", { httpOnly: true, secure: true, sameSite: "None" })
    .clearCookie("RefreshToken", { httpOnly: true, secure: true, sameSite: "None" })
    .clearCookie("UserID", { httpOnly: false, secure: true, sameSite: "None" })
    .status(200)
    .json({ success: true, message: "Logged out successfully" });
};

exports.sendVerificationCode = async (req, res) => {
  try {
    const email = req.user.email; // Get email from authenticated user
    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      return res.status(404).json({ success: false, message: "User does not exist!" });
    }
    if (existingUser.verified) {
      return res.status(400).json({ success: false, message: "You are already verified!" });
    }

    const codeValue = Math.floor(Math.random() * 1000000).toString();
    let info = await transport.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
      to: existingUser.email,
      subject: "verification code",
      html: `<h1>${codeValue}</h1>`,
    });

    if (info.accepted[0] === existingUser.email) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE_SECRET
      );
      existingUser.verificationCode = hashedCodeValue;
      existingUser.verificationCodeValidation = Date.now();
      await existingUser.save();
      return res.status(200).json({ success: true, message: "Code sent!" });
    }
    res.status(400).json({ success: false, message: "Code send failed!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.verifyVerificationCode = async (req, res) => {
  try {
    const email = req.user.email; // Get email from authenticated user
    const { providedCode } = req.body;

    const { error, value } = acceptCodeSchema.validate({ email: req.user.email, providedCode });
    if (error) {
      return res.status(401).json({ success: false, message: error.details[0].message });
    }

    const codeValue = providedCode.toString();
    const existingUser = await User.findOne({ email }).select(
      "+verificationCode +verificationCodeValidation"
    );

    if (!existingUser) {
      return res.status(401).json({ success: false, message: "User does not exist!" });
    }
    if (existingUser.verified) {
      return res.status(400).json({ success: false, message: "You are already verified!" });
    }

    if (!existingUser.verificationCode || !existingUser.verificationCodeValidation) {
      return res.status(400).json({ success: false, message: "Something is wrong with the code!" });
    }

    if (Date.now() - existingUser.verificationCodeValidation > 5 * 60 * 1000) {
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
      return res.status(200).json({ success: true, message: "Your account has been verified!" });
    }
    return res.status(400).json({ success: false, message: "Invalid code!" });
  } catch (error) {
    console.log(error);
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
      return res.status(401).json({ success: false, message: error.details[0].message });
    }

    // Check if user is verified
    if (!verified) {
      return res.status(401).json({ success: false, message: "You are not a verified user!" });
    }

    // Find the user based on userId
    const existingUser = await User.findOne({ _id: userId }).select("+password");
    if (!existingUser) {
      return res.status(401).json({ success: false, message: "User does not exist!" });
    }

    // Validate the old password
    const isOldPasswordValid = await doHashValidation(oldPassword, existingUser.password);
    if (!isOldPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid current password!" });
    }

    // Ensure the new password is different from the old password
    if (oldPassword === newPassword) {
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

    return res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.sendForgotPasswordCode = async (req, res) => {
  const { email } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: "User does not exists!" });
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
      return res.status(200).json({ success: true, message: "Code sent!" });
    }
    res.status(400).json({ success: false, message: "Code sent failed!" });
  } catch (error) {
    console.log(error);
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
      return res
        .status(401)
        .json({ success: false, message: "User does not exists!" });
    }

    if (
      !existingUser.forgotPasswordCode ||
      !existingUser.forgotPasswordCodeValidation
    ) {
      return res
        .status(400)
        .json({ success: false, message: "something is wrong with the code!" });
    }

    if (
      Date.now() - existingUser.forgotPasswordCodeValidation >
      5 * 60 * 1000
    ) {
      return res
        .status(400)
        .json({ success: false, message: "code has been expired!" });
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
      return res
        .status(200)
        .json({ success: true, message: "Password updated!!" });
    }
    return res
      .status(400)
      .json({ success: false, message: "unexpected occured!!" });
  } catch (error) {
    console.log(error);
  }
};

exports.loginSuccess = (req, res) => {
  if (req.user) {
    res.status(200).json({
      success: true,
      message: "Successfully logged in",
      user: req.user,
    });
  } else {
    res.status(401).json({ success: false, message: "Not authenticated" });
  }
};

exports.loginFailure = (req, res) => {
  res.status(401).json({ success: false, message: "Login failed" });
};

exports.logoutUser = (req, res) => {
  req.logout(() => {
    res.status(200).json({ success: true, message: "Logged out successfully" });
  });
};
