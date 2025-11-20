const express = require('express');
const router = express.Router();
const { requireOwner } = require('../middleware/ownerAuth');
const { listOwnerEbooks, createOwnerEbook, updateOwnerEbook, deleteOwnerEbook } = require('../controllers/ownerEbookController');
const { uploadCoverImage } = require('../middleware/upload');

router.use(requireOwner);

router.get('/ebooks', listOwnerEbooks);
router.post('/ebooks', uploadCoverImage, createOwnerEbook);
router.put('/ebooks/:id', uploadCoverImage, updateOwnerEbook);
router.delete('/ebooks/:id', deleteOwnerEbook);

module.exports = router;