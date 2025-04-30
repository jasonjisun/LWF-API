const mongoose = require("mongoose");
const EMR = require("../models/emrModel");

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

    // Make sure it's a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const normalizedUserId = new mongoose.Types.ObjectId(userId);

    // Find EMR by userId first
    const existingEMR = await EMR.findOne({ userId: normalizedUserId });

    if (!existingEMR) {
      return res.status(404).json({ success: false, message: "EMR not found for this user" });
    }

    // Sanitize input
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

    // Update
    const updatedEMR = await EMR.findOneAndUpdate(
      { userId: normalizedUserId },
      { $set: updateData },
      { new: true }
    );

    res.status(200).json({ success: true, emr: updatedEMR });
  } catch (err) {
    console.error("Update EMR error", err);
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

    // Check if userId is valid
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
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        emrData[field] = req.body[field];
      }
    });

    const newEMR = new EMR(emrData);
    await newEMR.save();

    res.status(201).json({ success: true, emr: newEMR });
  } catch (err) {
    console.error("Create EMR error", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};