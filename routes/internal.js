const express = require('express');
const router = express.Router();
const themeController = require('../controllers/themeController');

// POST /api/internal/theme-sync
router.post('/theme-sync', themeController.syncTheme);

// GET /api/internal/theme - return current persisted theme setting
router.get('/theme', themeController.getTheme);

module.exports = router;

