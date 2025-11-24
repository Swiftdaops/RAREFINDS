const express = require('express');
const router = express.Router();
const { getPublicBooks } = require('../controllers/bookController');

// Public endpoints for searching/browsing books
// Support both `/` and `/all` so frontend fallbacks like `/api/books/all` succeed.
router.get(['/', '/all'], getPublicBooks);

module.exports = router;
