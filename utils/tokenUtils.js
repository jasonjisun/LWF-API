const jwt = require("jsonwebtoken");

const verifyToken = (token, secret) => jwt.verify(token, secret);

const generateAccessToken = ({ userId, email, role }) => {
  return jwt.sign({ userId, email, role }, process.env.TOKEN_SECRET, {
    expiresIn: "8h",
  });
};

const verifyRefreshToken = (refreshToken) => {
  return jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
};

module.exports = {
  verifyToken,
  verifyRefreshToken,
  generateAccessToken,
};
