const fs = require('fs')
const path = require('path')
const multer = require('multer');
let uploadCoverImage;
let uploadMultipleImages;

const { CloudinaryStorage } = (() => {
  try {
    return require('multer-storage-cloudinary');
  } catch (e) {
    return {};
  }
})();

const cloudinary = require('../config/cloudinary');

const cloudConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (cloudConfigured && CloudinaryStorage) {
  console.log('Using Cloudinary Storage for uploads');
  const storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => {
      const isCover = file.fieldname === 'coverImage';
      const folder = isCover ? 'ebook_covers' : 'other_uploads';
      return {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      };
    },
  });

  uploadCoverImage = multer({ storage }).single('coverImage');
  uploadMultipleImages = multer({ storage }).array('images', 5);
} else {
  console.log('Using Local Storage for uploads');
  // Fallback: store uploads locally under ./uploads
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      const safe = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${safe}${ext}`);
    },
  });

  const uploader = multer({ storage });
  // normalize to same API shape as CloudinaryStorage (req.file.path contains a URL/path)
  uploadCoverImage = (req, res, next) => {
    const single = uploader.single('coverImage');
    single(req, res, function (err) {
      if (err) return next(err);
      if (req.file) {
        // expose path and filename similar to cloudinary storage
        req.file.path = `/uploads/${req.file.filename}`; // relative URL; serve statically if desired
        req.file.filename = req.file.filename;
      }
      next();
    });
  };

  uploadMultipleImages = uploader.array('images', 5);
}

module.exports = { uploadCoverImage, uploadMultipleImages };
