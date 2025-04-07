const { createHmac } = require("crypto");
const { hash, compare } = require("bcryptjs");

/**
 * Hash a value securely using bcrypt.
 * @param {string} value - The value to hash.
 * @param {number} saltRounds - The number of salt rounds (default: 10).
 * @returns {Promise<string>} - The hashed value.
 */
exports.doHash = async (value, saltRounds = 10) => {
  // Hash the value using bcryptjs with the specified salt rounds (default 10)
  return await hash(value, saltRounds);
};

/**
 * Validate a value against a hashed value.
 * @param {string} value - The original value (e.g., password).
 * @param {string} hashedValue - The hashed value for comparison.
 * @returns {Promise<boolean>} - Returns `true` if matches, otherwise `false`.
 */
exports.doHashValidation = async (value, hashedValue) => {
  // Compare the value with the hashed value to check if they match
  return await compare(value, hashedValue);
};

/**
 * Generate an HMAC hash using SHA-256.
 * @param {string} value - The value to hash (e.g., verification code).
 * @param {string} key - The secret key used for HMAC.
 * @returns {string} - The generated HMAC hash in hex format.
 */
exports.hmacProcess = (value, key) => {
  // Generate an HMAC hash with SHA-256 using the provided key and value
  return createHmac("sha256", key).update(value).digest("hex");
};
