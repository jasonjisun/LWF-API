const mongoose = require("mongoose");
const EMR = require("../models/emrModel");
const Log = require('../models/logsModel');

// 🧑‍⚕️ Doctor/Admin: Get all EMRs
exports.getAllPatientEMR = async (req, res) => {
  try {
    const allEMRs = await EMR.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, emrs: allEMRs });
  } catch (err) {
    console.error("Get all EMRs error", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 🧑‍⚕️ Doctor/Admin: Get EMR by userId
exports.getPatientEMR = async (req, res) => {
  try {
    const { userId } = req.params;
    const emr = await EMR.findOne({ userId });

    if (!emr) {
      return res.status(404).json({ success: false, message: "EMR not found" });
    }

    res.status(200).json({ success: true, emr });
  } catch (err) {
    console.error("Get EMR by userId error", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.updateEMRByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // Ensure it's a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const normalizedUserId = new mongoose.Types.ObjectId(userId);

    // Find existing EMR by userId
    const existingEMR = await EMR.findOne({ userId: normalizedUserId });

    if (!existingEMR) {
      return res.status(404).json({ success: false, message: "EMR not found for this user" });
    }

    // Sanitize input to only allow specific fields for update
    const allowedFields = [
      "name", "dob", "age", "gender", "bloodType", "contact", "email",
      "address", "allergies", "conditions", "medications", "visitHistory"
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // If no fields are provided for update, return an error
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided to update." });
    }

    // Update EMR
    const updatedEMR = await EMR.findOneAndUpdate(
      { userId: normalizedUserId },
      { $set: updateData },
      { new: true }
    );

    // Log the successful update for audit purposes
    await Log.create({
      action: 'UPDATE_EMR',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'EMR updated successfully.',
      details: { userId: normalizedUserId, updatedFields: Object.keys(updateData) },
    });

    // Send response
    res.status(200).json({ success: true, emr: updatedEMR });

  } catch (err) {
    console.error("Update EMR error", err);

    // Log the error for audit purposes
    await Log.create({
      action: 'UPDATE_EMR_ERROR',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Error updating EMR.',
      error: err.message,  // Log the error message
      details: { userId: req.params.userId },
    });

    res.status(500).json({ success: false, message: "Server Error" });
  }
};


// 👤 Patient: Get their own EMR
exports.getOwnEMR = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("GET /emr/own => userId from token:", userId); // 👈 Add this

    const emr = await EMR.findOne({ userId });

    if (!emr) {
      console.log("EMR not found for userId:", userId); // 👈 And this
      return res.status(404).json({ success: false, message: "EMR not found" });
    }

    res.status(200).json({ success: true, emr });
  } catch (err) {
    console.error("Get own EMR error", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.createEMRForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Ensure it's a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // Check if EMR already exists
    const existingEMR = await EMR.findOne({ userId });
    if (existingEMR) {
      return res.status(400).json({ success: false, message: "EMR already exists for this user" });
    }

    // Allowed fields for EMR creation
    const allowedFields = [
      "name", "dob", "age", "gender", "bloodType", "contact", "email",
      "address", "allergies", "conditions", "medications", "visitHistory"
    ];

    const emrData = { userId };

    // Sanitize input: only include allowed fields
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        emrData[field] = req.body[field];
      }
    });

    // If no valid data is provided, return a response
    if (Object.keys(emrData).length === 1) {  // only userId exists, no other fields provided
      return res.status(400).json({ success: false, message: "No valid data provided for EMR creation." });
    }

    // Create the new EMR entry
    const newEMR = new EMR(emrData);
    await newEMR.save();

    // Log the successful creation for audit purposes
    await Log.create({
      action: 'CREATE_EMR',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'EMR created successfully.',
      details: { userId, emrData },
    });

    // Return the created EMR
    res.status(201).json({ success: true, emr: newEMR });

  } catch (err) {
    console.error("Create EMR error", err);

    // Log the error for auditing
    await Log.create({
      action: 'CREATE_EMR_ERROR',
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
      endpoint: req.originalUrl,
      message: 'Error creating EMR.',
      error: err.message,
      details: { userId: req.params.userId },
    });

    res.status(500).json({ success: false, message: "Server Error" });
  }
};