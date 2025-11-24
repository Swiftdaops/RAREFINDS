const multer = require('multer');

// We'll keep files in memory and stream to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = { upload };
