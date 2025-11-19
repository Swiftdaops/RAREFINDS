const express = require('express');
const router = express.Router();
const { login, logout, me, listOwners, approveOwner, rejectOwner } = require('../controllers/adminController');
const requireAdmin = require('../middleware/requireAdmin');

// Auth
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAdmin, me);

// Owner management (admin only)
router.get('/owners', requireAdmin, listOwners);
router.patch('/owners/:id/approve', requireAdmin, approveOwner);
router.patch('/owners/:id/reject', requireAdmin, rejectOwner);

module.exports = router;
