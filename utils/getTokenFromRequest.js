const getAccessToken = (req) => {
    if (req.headers.client === "not-browser") {
      return req.headers.authorization?.split(" ")[1];
    } else {
      return req.cookies.Authorization?.split("Bearer ")[1];
    }
  };
  
  module.exports = getAccessToken;
  