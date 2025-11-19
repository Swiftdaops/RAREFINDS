const express = require('express');
const router = express.Router();
const { createEbook, getEbooks, updateEbook, deleteEbook } = require('../controllers/ebookController');
const requireAdmin = require('../middleware/requireAdmin');
const { uploadCoverImage } = require('../middleware/upload');

// Admin-only listing & CRUD
router.get('/', requireAdmin, getEbooks);
router.post('/', requireAdmin, uploadCoverImage, createEbook);
router.put('/:id', requireAdmin, uploadCoverImage, updateEbook);
router.delete('/:id', requireAdmin, deleteEbook);

module.exports = router;
