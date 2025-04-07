const jwt = require("jsonwebtoken");

exports.identifier = (req, res, next) => {
  let token = req.headers.authorization || req.cookies["Authorization"];

  if (token && token.startsWith("Bearer ")) {
    token = token.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized: No token provided." });
  }

  console.log("🔹 Token being verified:", token);
  console.log("🔹 TOKEN_SECRET in Environment:", process.env.TOKEN_SECRET);

  if (!process.env.TOKEN_SECRET) {
    console.error("🔴 Missing TOKEN_SECRET in environment variables.");
    return res.status(500).json({ success: false, message: "Server Error: Missing TOKEN_SECRET." });
  }

  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.error("🔴 JWT Verification Error:", err.message);
      return res.status(403).json({ success: false, message: "Failed to authenticate token.", error: err.message });
    }

    console.log("🔹 Decoded Token Data:", decoded);

    req.user = {
      userId: decoded.userId,
      verified: decoded.verified,
      role: decoded.role,
    };

    next();
  });
};
