const PatientProfile = require("../models/patientProfileModel");
const User = require("../models/usersModel");

exports.createPatientProfile = async (req, res, next) => {
  const { name, dob, gender, age, contact, address } = req.body;
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);
    if (!user || user.role !== "patient") {
      return res.status(403).json({ success: false, message: "Not authorized." });
    }

    const existingProfile = await PatientProfile.findOne({ user: userId });
    if (existingProfile) {
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

    // inject email for sendVerificationCode
    req.body.email = user.email;
    next(); // go to sendVerificationCode
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
};

exports.updatePatientProfile = async (req, res) => {
    const { name, dob, gender, age, contact, address } = req.body;
    const userId = req.user._id;
  
    try {
      const profile = await PatientProfile.findOne({ user: userId });
  
      if (!profile) {
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
  
      return res.status(200).json({ success: true, profile, message: "Profile updated successfully." });
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, message: "Something went wrong." });
    }
  };
