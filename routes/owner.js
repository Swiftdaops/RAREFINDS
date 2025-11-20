const express = require('express');
const router = express.Router();
const { signup, login, me, logout } = require('../controllers/ownerController');
const { requireOwner } = require('../middleware/ownerAuth');

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireOwner, me);
router.post('/logout', logout);

module.exports = router;