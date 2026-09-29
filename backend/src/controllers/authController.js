const authService = require('../services/authService');
const { asyncHandler, sendResponse } = require('../utils/helpers');

const register = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const result = await authService.register(data);
  sendResponse(res, 201, result, 'Registration successful');
});

const login = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const result = await authService.login(data);
  sendResponse(res, 200, result, 'Login successful');
});

const profile = asyncHandler(async (req, res) => {
  const result = await authService.getProfile(req.user.id);
  sendResponse(res, 200, result);
});

const logout = asyncHandler(async (req, res) => {
  sendResponse(res, 200, null, 'Logout successful. Please remove the token from client storage.');
});

module.exports = {
  register,
  login,
  profile,
  logout,
};
