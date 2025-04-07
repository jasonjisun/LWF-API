const userService = require("../services/userService");
const successHandler = require("../utils/successHandler");
const errorHandler = require("../utils/errorHandler");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    successHandler(res, { users });
  } catch (error) {
    errorHandler(res, { status: 500, message: error.message });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await userService.getUserProfile(req.params.id);
    if (!user) return errorHandler(res, { status: 404, message: "User not found" });
    successHandler(res, { user });
  } catch (error) {
    errorHandler(res, { status: 500, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const updatedUser = await userService.updateUser(req.params.id, req.body);
    if (!updatedUser) return errorHandler(res, { status: 404, message: "User not found" });
    successHandler(res, { user: updatedUser });
  } catch (error) {
    errorHandler(res, { status: 500, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deletedUser = await userService.deleteUser(req.params.id);
    if (!deletedUser) return errorHandler(res, { status: 404, message: "User not found" });
    successHandler(res, { message: "User deleted successfully" });
  } catch (error) {
    errorHandler(res, { status: 500, message: error.message });
  }
};
