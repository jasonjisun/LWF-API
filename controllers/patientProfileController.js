const PatientProfile = require("../models/patientProfileModel");
const User = require("../models/usersModel");
const Log = require('../models/logsModel');

exports.createPatientProfile = async (req, res) => {
  const { name, dob, gender, age, contact, address } = req.body;
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);
    const ip = req.ip;
    const endpoint = req.originalUrl;

    if (!user || user.role !== "patient") {
      await Log.create({
        action: "Create Patient Profile - Unauthorized access",
        role: req.user?.role || "unknown",
        email: req.user?.email || "unknown",
        ip,
        endpoint,
      });

      return res.status(403).json({ success: false, message: "Not authorized." });
    }

    const existingProfile = await PatientProfile.findOne({ user: userId });
    if (existingProfile) {
      await Log.create({
        action: "Create Patient Profile - Already exists",
        role: user.role,
        email: user.email,
        ip,
        endpoint,
      });

      return res.status(400).json({ success: false, message: "Profile already exists." });
    }

    const profile = await PatientProfile.create({
      user: userId,
      name,
      dob,
      gender,
      age,
      contact,
      address,
    });

    await Log.create({
      action: "Create Patient Profile - Success",
      role: user.role,
      email: user.email,
      ip,
      endpoint,
    });

    res.status(201).json({ success: true, message: "Profile created successfully.", profile });
  } catch (error) {
    console.log(error);

    await Log.create({
      action: "Create Patient Profile - Server error",
      role: req.user?.role || "unknown",
      email: req.user?.email || "unknown",
      ip: req.ip,
      endpoint: req.originalUrl,
    });

    res.status(500).json({ success: false, message: "Something went wrong." });
  }
};

exports.updatePatientProfile = async (req, res) => {
  const { name, dob, gender, age, contact, address } = req.body;
  const userId = req.user._id;

  try {
    const profile = await PatientProfile.findOne({ user: userId });
    const ip = req.ip;
    const endpoint = req.originalUrl;

    if (!profile) {
      await Log.create({
        action: "Update Patient Profile - Not Found",
        role: req.user?.role || "unknown",
        email: req.user?.email || "unknown",
        ip,
        endpoint,
      });

      return res.status(404).json({ success: false, message: "Profile not found." });
    }

    // Only update fields if provided
    profile.name = name ?? profile.name;
    profile.dob = dob ?? profile.dob;
    profile.gender = gender ?? profile.gender;
    profile.age = age ?? profile.age;
    profile.contact = contact ?? profile.contact;
    profile.address = address ?? profile.address;

    await profile.save();

    await Log.create({
      action: "Update Patient Profile - Success",
      role: req.user?.role || "unknown",
      email: req.user?.email || "unknown",
      ip,
      endpoint,
    });

    return res.status(200).json({ success: true, profile, message: "Profile updated successfully." });
  } catch (error) {
    console.log(error);

    await Log.create({
      action: "Update Patient Profile - Server Error",
      role: req.user?.role || "unknown",
      email: req.user?.email || "unknown",
      ip: req.ip,
      endpoint: req.originalUrl,
    });

    res.status(500).json({ success: false, message: "Something went wrong." });
  }
};

exports.updateAnyPatientProfile = async (req, res) => {
  const { userId, name, dob, gender, age, contact, address } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "User ID is required." });
  }

  try {
    const profile = await PatientProfile.findOne({ user: userId });
    const ip = req.ip;
    const endpoint = req.originalUrl;

    if (!profile) {
      await Log.create({
        action: "Update Any Patient Profile - Not Found",
        role: req.user?.role || "unknown",
        email: req.user?.email || "unknown",
        ip,
        endpoint,
      });

      return res.status(404).json({ success: false, message: "Profile not found." });
    }

    // Update only if value is provided
    profile.name = name ?? profile.name;
    profile.dob = dob ?? profile.dob;
    profile.gender = gender ?? profile.gender;
    profile.age = age ?? profile.age;
    profile.contact = contact ?? profile.contact;
    profile.address = address ?? profile.address;

    await profile.save();

    await Log.create({
      action: `Update Any Patient Profile - Success (UserID: ${userId})`,
      role: req.user?.role || "unknown",
      email: req.user?.email || "unknown",
      ip,
      endpoint,
    });

    return res.status(200).json({ success: true, profile, message: "Profile updated successfully." });
  } catch (error) {
    console.error(error);

    await Log.create({
      action: `Update Any Patient Profile - Error (UserID: ${userId})`,
      role: req.user?.role || "unknown",
      email: req.user?.email || "unknown",
      ip: req.ip,
      endpoint: req.originalUrl,
    });

    return res.status(500).json({ success: false, message: "Server error." });
  }
};

  // Get all patient profiles (for admin or doctor)
exports.getAllPatientProfiles = async (req, res) => {
  try {
    const profiles = await PatientProfile.find().populate("user", "-password");

    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ success: false, message: "No profiles found." });
    }

    return res.status(200).json({ success: true, profiles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
};

exports.getPatientsWithEmail = async (req, res) => {
  try {
    // Fetch all patient profiles with populated email from User model
    const patients = await PatientProfile.find()
      .populate("user", "email") // Populating only the email field from User model
      .exec();

    if (!patients || patients.length === 0) {
      return res.status(404).json({ success: false, message: "No patients found" });
    }

    // Send the patients data along with their email
    res.status(200).json({ success: true, profiles: patients });
  } catch (err) {
    console.error("Error fetching patients with email", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

  // Get own patient profile (for patient)
exports.getOwnPatientProfile = async (req, res) => {
  const userId = req.user._id;

  try {
    const profile = await PatientProfile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found." });
    }

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
};

// Get any patient profile by ID (for admin or doctor)
exports.getPatientProfile = async (req, res) => {
  const { patientId } = req.params;

  try {
    const profile = await PatientProfile.findOne({ user: patientId }).populate("user", "-password");

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found." });
    }

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
};

exports.getPatientVerificationStatus = async (req, res) => {
  const { patientId } = req.params;

  try {
    // Step 1: Find the PatientProfile by its _id
    const patientProfile = await PatientProfile.findById(patientId);

    if (!patientProfile) {
      return res.status(404).json({ success: false, message: "Patient profile not found." });
    }

    // Step 2: Use the `user` field from PatientProfile to find the User
    const user = await User.findById(patientProfile.user).select("verified");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({ success: true, isVerified: user.verified });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
};