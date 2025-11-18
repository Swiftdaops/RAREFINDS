const express = require('express');
const router = express.Router();
const { createEbook, getEbooks, updateEbook, deleteEbook } = require('../controllers/ebookController');
const { protect, admin } = require('../middleware/auth');
const { uploadCoverImage } = require('../middleware/upload');

router.get('/', getEbooks);

router.post('/', protect, admin, uploadCoverImage, createEbook);

router.put('/:id', protect, admin, uploadCoverImage, updateEbook);

router.delete('/:id', protect, admin, deleteEbook);

module.exports = router;
