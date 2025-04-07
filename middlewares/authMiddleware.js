const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  let token = req.headers["authorization"] || req.cookies["Authorization"];

  if (token && token.startsWith("Bearer ")) {
    token = token.split(" ")[1];
  }

  if (!token) {
    return res.status(403).json({ success: false, message: "No token provided." });
  }

  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ success: false, message: "Failed to authenticate token." });

    req.user = decoded; 
    next();
  });
};

module.exports = authenticate;