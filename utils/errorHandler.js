const errorHandler = (res, { status = 400, message }) => {
    return res.status(status).json({
      success: false,
      message,
    });
  };
  
  module.exports = errorHandler;