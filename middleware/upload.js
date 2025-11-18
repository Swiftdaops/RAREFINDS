const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

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

const uploadCoverImage = multer({ storage }).single('coverImage');
const uploadMultipleImages = multer({ storage }).array('images', 5);

module.exports = { uploadCoverImage, uploadMultipleImages };
