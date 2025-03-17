const jwt = require("jsonwebtoken");

exports.identifier = (req, res, next) => {
  let token;
  
  if (req.headers.client === "not-browser") {
      token = req.headers.authorization;
  } else {
      token = req.cookies["Authorization"];
  }

  console.log("Received Token:", token);  // Add this for debugging

  if (!token) {
      return res.status(403).json({ success: false, message: "Unauthorized: No token provided." });
  }

  try {
      const userToken = token.split(" ")[1];
      console.log("Extracted Token:", userToken);  // Debugging log
      
      const jwtVerified = jwt.verify(userToken, process.env.TOKEN_SECRET);
      console.log("Verified Token:", jwtVerified);  // Debugging log

      req.user = jwtVerified;
      next();
  } catch (error) {
      console.error("Token verification error:", error.message);
      return res.status(401).json({ success: false, message: "Invalid token." });
  }
};
