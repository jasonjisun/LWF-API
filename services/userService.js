const User = require("../models/userModel");

const userService = {};

// Get all users (Admin only)
userService.getAllUsers = async () => {
  try {
    const users = await User.find();
    if (!users || users.length === 0) {
      throw new Error("No users found in the database");
    }
    return users;
  } catch (error) {
    throw new Error("Failed to retrieve users: " + error.message);
  }
};

// Get user profile (Doctor/Admin)
userService.getUserProfile = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  } catch (error) {
    throw new Error("Failed to retrieve user profile: " + error.message);
  }
};

// Update user (Admin only)
userService.updateUser = async (userId, updateData) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  } catch (error) {
    throw new Error("Failed to update user: " + error.message);
  }
};

// Delete user (Admin only)
userService.deleteUser = async (userId) => {
  try {
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      throw new Error("User not found");
    }

    return deletedUser;
  } catch (error) {
    throw new Error("Failed to delete user: " + error.message);
  }
};

module.exports = userService;
