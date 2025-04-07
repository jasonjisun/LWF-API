const errorHandler = require("../utils/errorHandler");

const roleMiddleware = (roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;  

    console.log("User Role:", userRole); 

    if (!roles.includes(userRole)) {
      return errorHandler(res, { status: 403, message: "Forbidden: You don't have permission to access this resource." });
    }

    next();  
  };
};

module.exports = roleMiddleware;
