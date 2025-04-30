const AdminProfile = require("../models/adminProfileModel");

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
  
      const profile = await AdminProfile.findOne({ admin: adminId });
  
      if (!profile) {
        return res.status(404).json({ message: "Admin profile not found." });
      }
  
      // Ensure user is updating their own profile
      if (String(req.user._id) !== String(profile.admin)) {
        return res.status(403).json({ message: "You can only update your own profile." });
      }
  
      if (fullName) profile.fullName = fullName;
      if (email) profile.email = email;
      if (contactNumber) profile.contactNumber = contactNumber;
  
      const updatedProfile = await profile.save();
      res.status(200).json(updatedProfile);
    } catch (error) {
      console.error("Error updating admin profile:", error);
      res.status(500).json({ message: "Server error" });
    }
  };
  
