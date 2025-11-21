const AppSettings = require('../models/AppSettings');
const asyncHandler = require('express-async-handler');

// @desc    Get global app theme
// @route   GET /api/app-settings/theme
// @access  Public
const getTheme = asyncHandler(async (req, res) => {
  const settings = await AppSettings.getSettings();
  res.json({ themeMode: settings.themeMode });
});

// @desc    Update global app theme
// @route   PUT /api/admin/app-settings/theme
// @access  Private/Admin
const updateTheme = asyncHandler(async (req, res) => {
  const { themeMode } = req.body;

  if (!['light', 'dark'].includes(themeMode)) {
    res.status(400);
    throw new Error('Invalid theme mode. Must be "light" or "dark".');
  }

  let settings = await AppSettings.getSettings();
  settings.themeMode = themeMode;
  settings.updatedBy = req.user ? req.user._id : null; // Assuming req.user is populated by auth middleware
  settings.updatedAt = Date.now();
  
  await settings.save();

  res.json({ 
    message: 'Theme updated successfully', 
    themeMode: settings.themeMode 
  });
});

module.exports = {
  getTheme,
  updateTheme,
};
