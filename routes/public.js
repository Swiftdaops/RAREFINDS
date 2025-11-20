const express = require('express');
const router = express.Router();
const { listPublicEbooks } = require('../controllers/publicEbookController');

router.get('/ebooks', listPublicEbooks);

module.exports = router;