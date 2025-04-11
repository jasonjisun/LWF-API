const EMR = require("../models/emrModel");

// 🧑‍⚕️ Doctor/Admin: Get EMR by userId (param)
exports.getEMRByUserId = async (req, res) => {
  try {
    const { id } = req.params;
    const emr = await EMR.findOne({ userId: id });

    if (!emr) {
      return res.status(404).json({ success: false, message: "EMR not found" });
    }

    res.status(200).json(emr);
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 🧑‍⚕️ Doctor/Admin: Create or update any EMR
exports.upsertEMR = async (req, res) => {
  try {
    const { userId } = req.body;
    const emr = await EMR.findOneAndUpdate({ userId }, req.body, {
      new: true,
      upsert: true,
    });

    res.status(200).json({ success: true, emr });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 👤 Patient: Get their own EMR
exports.getOwnEMR = async (req, res) => {
  try {
    const userId = req.user.userId;
    const emr = await EMR.findOne({ userId });

    if (!emr) {
      return res.status(404).json({ success: false, message: "EMR not found" });
    }

    res.status(200).json(emr);
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 👤 Patient: Update their own EMR
exports.updateOwnEMR = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Optional: filter allowed fields for patient update
    const allowedFields = [
      "contact",
      "address",
      "allergies",
      "conditions",
      "medications",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const updatedEMR = await EMR.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedEMR) {
      return res.status(404).json({ success: false, message: "EMR not found" });
    }

    res.status(200).json({ success: true, emr: updatedEMR });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
