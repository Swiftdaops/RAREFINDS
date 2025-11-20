const express = require('express');
const asyncHandler = require('express-async-handler');

const router = express.Router();

// Try to require the AppSettings model; if the project uses ESM for that file
// the require may fail — we handle that and fall back to a default in-memory value.
let AppSettings = null;
try {
	AppSettings = require('../models/AppSettings');
} catch (err) {
	// model not available via require (possibly ESM file) — we'll fall back
	AppSettings = null;
}

const THEME_KEY = 'theme';

// Public: get current theme
router.get('/public/app-settings/theme', asyncHandler(async (req, res) => {
	if (AppSettings && typeof AppSettings.findOne === 'function') {
		const doc = await AppSettings.findOne({ key: THEME_KEY });
		return res.json({ theme: doc?.value?.theme || 'dark' });
	}

	// fallback default
	return res.json({ theme: process.env.DEFAULT_THEME || 'dark' });
}));

// Admin: update theme
router.put('/admin/app-settings/theme', asyncHandler(async (req, res) => {
	const { theme } = req.body || {};
	if (!['dark', 'light'].includes(theme)) {
		return res.status(400).json({ message: 'Invalid theme value' });
	}

	if (AppSettings && typeof AppSettings.findOneAndUpdate === 'function') {
		const value = { theme };
		const doc = await AppSettings.findOneAndUpdate(
			{ key: THEME_KEY },
			{ value },
			{ upsert: true, new: true }
		);
		return res.json({ theme: doc.value.theme });
	}

	// Fallback: respond success but don't persist
	return res.json({ theme });
}));

module.exports = router;
