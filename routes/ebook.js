const express = require('express');
const router = express.Router();
const { createEbook, getEbooks, updateEbook, deleteEbook } = require('../controllers/ebookController');
const adminOrOwner = require('../middleware/adminOrOwner');
const { uploadCoverImage } = require('../middleware/upload');

// Wrapper to debug upload middleware errors
const uploadWrapper = (req, res, next) => {
  uploadCoverImage(req, res, (err) => {
    if (err) {
      console.error('Upload Middleware Error:', err);
      return res.status(500).json({ error: 'File upload failed', details: err.message });
    }
    next();
  });
};

// Unified listing & CRUD for admin and owner
router.get('/', adminOrOwner, getEbooks);
router.post('/', adminOrOwner, uploadWrapper, createEbook);
router.put('/:id', adminOrOwner, uploadWrapper, updateEbook);
router.delete('/:id', adminOrOwner, deleteEbook);

module.exports = router;
