const express = require('express');
const router = express.Router();
const { getTheme, updateTheme } = require('../controllers/appSettingsController');
const requireAdmin = require('../middleware/requireAdmin');

// Public route to get theme
// Mounted at /api, so this becomes /api/app-settings/theme
router.get('/app-settings/theme', getTheme);

// Admin route to update theme
// Mounted at /api, so this becomes /api/admin/app-settings/theme
router.put('/admin/app-settings/theme', requireAdmin, updateTheme);

module.exports = router;
