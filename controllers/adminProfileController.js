const AdminProfile = require("../models/adminProfileModel");
const Log = require('../models/logsModel');

exports.getAdminProfile = async (req, res) => {
  try {
    const { adminId } = req.params;

    const profile = await AdminProfile.findOne({ admin: adminId }).populate("admin", "-password");

    if (!profile) {
      return res.status(404).json({ message: "Admin profile not found." });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createAdminProfile = async (req, res) => {
    try {
      const { fullName, email, contactNumber } = req.body;
  
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only admins can create profiles." });
      }
  
      const existingProfile = await AdminProfile.findOne({ admin: req.user._id });
      if (existingProfile) {
        return res.status(400).json({ message: "Admin profile already exists." });
      }
  
      const newProfile = new AdminProfile({
        admin: req.user._id,
        fullName,
        email,
        contactNumber,
      });
  
      const savedProfile = await newProfile.save();
      res.status(201).json(savedProfile);
    } catch (error) {
      console.error("Error creating admin profile:", error);
      res.status(500).json({ message: "Server error" });
    }
  };  

  exports.updateAdminProfile = async (req, res) => {
    try {
      const { adminId } = req.params;
      const { fullName, email, contactNumber } = req.body;
  
      // Find the admin profile
      const profile = await AdminProfile.findOne({ admin: adminId });
      if (!profile) {
        // Log if the admin profile is not found
        await Log.create({
          action: 'PROFILE_UPDATE_FAILED',
          email: req.user ? req.user.email : 'unknown',
          role: req.user ? req.user.role : 'unknown',
          ip: req.ip,
          endpoint: req.originalUrl,
          adminId: adminId,
          message: 'Admin profile not found.',
        });
        return res.status(404).json({ message: "Admin profile not found." });
      }
  
      // Ensure the user is updating their own profile
      if (String(req.user._id) !== String(profile.admin)) {
        // Log unauthorized update attempt
        await Log.create({
          action: 'UNAUTHORIZED_PROFILE_UPDATE',
          email: req.user ? req.user.email : 'unknown',
          role: req.user ? req.user.role : 'unknown',
          ip: req.ip,
          endpoint: req.originalUrl,
          adminId: adminId,
          message: 'User tried to update another user\'s profile.',
        });
        return res.status(403).json({ message: "You can only update your own profile." });
      }
  
      // Update profile fields if provided
      if (fullName) profile.fullName = fullName;
      if (email) profile.email = email;
      if (contactNumber) profile.contactNumber = contactNumber;
  
      const updatedProfile = await profile.save();
  
      // Log successful profile update
      await Log.create({
        action: 'PROFILE_UPDATED',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        adminId: adminId,
        message: 'Admin profile updated successfully.',
        updatedFields: { fullName, email, contactNumber },
      });
  
      res.status(200).json(updatedProfile);
    } catch (error) {
      console.error("Error updating admin profile:", error);
  
      // Log error during profile update
      await Log.create({
        action: 'PROFILE_UPDATE_ERROR',
        email: req.user ? req.user.email : 'unknown',
        role: req.user ? req.user.role : 'unknown',
        ip: req.ip,
        endpoint: req.originalUrl,
        adminId: adminId,
        message: 'Error updating admin profile.',
        error: error.message, // Include the error message for debugging
      });
  
      res.status(500).json({ message: "Server error" });
    }
  };