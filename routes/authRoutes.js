const express = require('express');
const router = express.Router();
const { signup, login, getMe, updateMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// Expect profile image field named 'profileImage'
router.post('/signup', upload.single('profileImage'), signup);
router.post('/login', login);
router.get('/me', protect, getMe);
// Allow owners to update their profile. Accepts multipart for `profileImage`.
router.put('/me', protect, upload.single('profileImage'), updateMe);

module.exports = router;
