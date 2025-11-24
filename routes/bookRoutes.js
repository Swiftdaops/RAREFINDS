const express = require('express');
const router = express.Router();
const { createBook, getMyBooks, deleteBook, updateBook } = require('../controllers/bookController');
const { protect } = require('../middleware/authMiddleware');
const { ensureApproved } = require('../middleware/statusCheck');
const { upload } = require('../middleware/uploadMiddleware');

// Accept either 'image' or 'coverImage' field names from the frontend.
router.post('/', protect, ensureApproved, upload.fields([
	{ name: 'image', maxCount: 1 },
	{ name: 'coverImage', maxCount: 1 }
]), createBook);
router.get('/', protect, ensureApproved, getMyBooks);
// Accept either `image` or `coverImage` on update as well (avoid Multer Unexpected field errors)
router.put('/:id', protect, ensureApproved, upload.fields([
	{ name: 'image', maxCount: 1 },
	{ name: 'coverImage', maxCount: 1 }
]), updateBook);
router.delete('/:id', protect, ensureApproved, deleteBook);

module.exports = router;
