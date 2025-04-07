require("dotenv").config();
const passport = require("passport");

// Import the passportConfig.js where the actual configuration is done
require("../config/passportConfig");  // Adjust path based on your folder structure

// Function to initialize passport strategies
const configurePassport = (passport) => {
  passport.initialize();
  passport.session();
};

module.exports = configurePassport;
