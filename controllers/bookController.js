const asyncHandler = require('express-async-handler');
const Book = require('../models/Book');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');

// Helper to upload buffer via stream
const uploadBufferToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ resource_type: 'image', folder: 'owner_books' }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
};

// @route POST /api/owner/books
const createBook = asyncHandler(async (req, res) => {
  try {
    const { title, price, author, description, format, currency } = req.body;

    // Basic server-side validation so frontend can safely rely on API responses
    if (!title || !price || !format || !currency) {
      res.status(400);
      return res.json({ message: 'Missing required fields: title, price, format, or currency' });
    }

    if (!['ebook', 'audiobook'].includes(format)) {
      res.status(400);
      return res.json({ message: "Invalid 'format' value. Allowed: 'ebook', 'audiobook'" });
    }

    // multer may populate req.file (single) or req.files (fields). Accept either 'image' or 'coverImage'.
    let file = req.file;
    if (!file && req.files) {
      if (req.files.image && req.files.image.length > 0) file = req.files.image[0];
      else if (req.files.coverImage && req.files.coverImage.length > 0) file = req.files.coverImage[0];
    }

    if (!file) {
      res.status(400);
      return res.json({ message: 'Image file required' });
    }

    // Require Cloudinary to be configured for image uploads. Do not fall back to local storage.
    const haveCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (!haveCloudinary) {
      console.error('Cloudinary not configured - image upload rejected');
      res.status(500);
      return res.json({ message: 'Server misconfiguration: Cloudinary not configured. Image uploads require Cloudinary.' });
    }

    let imageUrl;
    try {
      const result = await uploadBufferToCloudinary(file.buffer, file.originalname);
      // Store a plain string URL to the uploaded image
      imageUrl = result.secure_url;
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      console.error('Cloudinary upload failed:', msg);
      res.status(500);
      return res.json({ message: 'Image upload failed', detail: msg });
    }

    // Ensure price is stored as a Number. Accept numeric strings too.
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice)) {
      res.status(400);
      return res.json({ message: 'Invalid price value' });
    }

    // Ensure currency is valid according to schema enum. Mongoose will enforce, but do a quick check.
    const allowedCurrencies = ['NGN', 'USD', 'EUR', 'GBP'];
    if (!allowedCurrencies.includes(currency)) {
      res.status(400);
      return res.json({ message: `Invalid currency. Allowed: ${allowedCurrencies.join(',')}` });
    }

    // Prefer the owner's explicit whatsappNumber field; fall back to other phone-like fields
    const ownerWhatsApp = (req.owner && (req.owner.whatsappNumber || req.owner.whatsapp || req.owner.phone)) || undefined;
    // Store the image URL string in `coverImage` field
    const bookDoc = await Book.create({ title, price: numericPrice, currency, author, description, format, coverImage: imageUrl, owner: req.owner._id, ownerWhatsApp });

    // Populate minimal owner info before returning so frontend immediately has owner name/profile
    const populated = await Book.findById(bookDoc._id).populate('owner', 'name profileImage whatsappNumber').lean();
    return res.status(201).json(populated);
  } catch (err) {
    // Log error for server console and return a safe message to client
    const msg = err && err.message ? err.message : String(err);
    console.error('createBook error:', msg);
    res.status(500).json({ message: 'Failed to create book', detail: msg });
  }
});

// @route GET /api/owner/books
const getMyBooks = asyncHandler(async (req, res) => {
  const books = await Book.find({ owner: req.owner._id });
  res.status(200).json(books);
});

// @route DELETE /api/owner/books/:id
const deleteBook = asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await Book.findById(bookId);
    if (!book) {
      res.status(404).json({ message: 'Book not found' });
      return;
    }
    // Defensive owner check: ensure book.owner exists and matches request owner
    if (!book.owner) {
      console.warn(`deleteBook: book ${bookId} has no owner field`);
      res.status(403).json({ message: 'Not authorized to delete this book' });
      return;
    }
    if (book.owner.toString() !== req.owner._id.toString()) {
      res.status(403).json({ message: 'Not authorized to delete this book' });
      return;
    }

    try {
      // Use the model-level delete to avoid relying on document instance methods
      await Book.deleteOne({ _id: book._id });
      return res.json({ message: 'Book deleted' });
    } catch (removeErr) {
      // Log and rethrow to be handled by outer catch
      console.error(`Error deleting book ${bookId}:`, removeErr && removeErr.stack ? removeErr.stack : removeErr);
      throw removeErr;
    }
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? err.stack : null;
    console.error('deleteBook error:', msg);
    if (stack) console.error(stack);
    // Include error detail to help debugging client-side (temporary)
    const payload = { message: 'Failed to delete book', detail: msg };
    if (stack) payload.stack = stack;
    res.status(500).json(payload);
  }
});

// @route PUT /api/owner/books/:id
const updateBook = asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.owner.toString() !== req.owner._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this book' });
    }

    const { title, price, author, description, format, currency } = req.body;
    if (title !== undefined) book.title = title;
    if (price !== undefined) {
      const numericPrice = Number(price);
      if (Number.isNaN(numericPrice)) {
        return res.status(400).json({ message: 'Invalid price value' });
      }
      book.price = numericPrice;
    }
    if (author !== undefined) book.author = author;
    if (description !== undefined) book.description = description;
    if (format !== undefined) {
      if (!['ebook', 'audiobook'].includes(format)) {
        return res.status(400).json({ message: "Invalid 'format' value" });
      }
      book.format = format;
    }
    if (currency !== undefined) {
      const allowedCurrencies = ['NGN', 'USD', 'EUR', 'GBP'];
      if (!allowedCurrencies.includes(currency)) {
        return res.status(400).json({ message: 'Invalid currency' });
      }
      book.currency = currency;
    }

    // Accept uploaded file from multer. Support both `req.file` (single) and
    // `req.files` (fields) so the route can accept either 'image' or 'coverImage'.
    let uploadedFile = req.file;
    if (!uploadedFile && req.files) {
      if (req.files.image && req.files.image.length > 0) uploadedFile = req.files.image[0];
      else if (req.files.coverImage && req.files.coverImage.length > 0) uploadedFile = req.files.coverImage[0];
    }

    if (uploadedFile) {
      let imageUrl;
      const haveCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
      if (haveCloudinary) {
        try {
          const result = await uploadBufferToCloudinary(uploadedFile.buffer, uploadedFile.originalname);
          imageUrl = result.secure_url;
        } catch (e) {
          console.error('Cloudinary update upload failed:', e && e.message ? e.message : e);
        }
      }
      if (!imageUrl) {
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
        const filename = Date.now() + '-' + uploadedFile.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, uploadedFile.buffer);
        imageUrl = `local:${filename}`;
      }
      book.coverImage = imageUrl;
    }

    // Ensure ownerWhatsApp is preserved/derived from the authenticated owner if not provided
    if (!book.ownerWhatsApp) {
      const derivedWhats = (req.owner && (req.owner.whatsappNumber || req.owner.whatsapp || req.owner.phone)) || undefined;
      if (derivedWhats) book.ownerWhatsApp = derivedWhats;
    }

    await book.save();
    // Return populated book so client sees owner details immediately
    const refreshed = await Book.findById(book._id).populate('owner', 'name profileImage whatsappNumber').lean();
    res.json(refreshed);
  } catch (err) {
    console.error('updateBook error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Failed to update book' });
  }
});

module.exports = { createBook, getMyBooks, deleteBook, updateBook };

// Public books listing for frontend search and discovery
// @route GET /api/books or /api/ebooks or /api/public/books
const getPublicBooks = asyncHandler(async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const filter = {};
    if (q && q.length > 0) {
      const regex = new RegExp(q, 'i');
      filter.$or = [{ title: regex }, { author: regex }];
    }

    // Populate owner minimal info (including whatsappNumber) so we can filter by approved status
    const books = await Book.find(filter).populate('owner', 'status name profileImage whatsappNumber').sort({ createdAt: -1 }).lean();

    // Only expose books whose owner is approved (helps prevent listing drafts)
    const publicBooks = books.filter((b) => {
      if (!b.owner) return false;
      return String(b.owner.status) === 'approved';
    }).map((b) => {
      // Normalize shape for frontend: ensure id/_id consistency and remove owner.status
      const out = Object.assign({}, b);
      out.id = b._id;
      if (out.owner && out.owner.status) delete out.owner.status;
      return out;
    });

    return res.json(publicBooks);
  } catch (err) {
    console.error('getPublicBooks error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Failed to fetch public books' });
  }
});

// Export public controller
module.exports.getPublicBooks = getPublicBooks;
