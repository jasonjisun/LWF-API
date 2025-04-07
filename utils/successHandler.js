const successHandler = (res, { status = 200, message, token, refreshToken, role }) => {
  const response = { success: true, message };

  if (token) response.token = token;
  if (refreshToken) response.refreshToken = refreshToken;
  if (role) response.role = role;

  return res.status(status).json(response);
};

module.exports = successHandler;
