const asyncHandler = require('express-async-handler');
const Joi = require('joi');
const cloudinary = require('../config/cloudinary');
const Ebook = require('../models/Ebook');

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'NGN';

const priceObjectSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  currency: Joi.string().min(1).optional(),
});

const baseSchema = {
  title: Joi.string().min(1).required(),
  author: Joi.string().min(1).required(),
  description: Joi.string().allow('').optional(),
  // allow either a number (legacy) or an object { amount, currency }
  price: Joi.alternatives().try(Joi.number().min(0), priceObjectSchema).optional(),
  currency: Joi.string().min(1).optional(),
};

const createSchema = Joi.object(baseSchema);
const updateSchema = Joi.object({
  title: Joi.string().min(1),
  author: Joi.string().min(1),
  description: Joi.string().min(1),
  price: Joi.alternatives().try(Joi.number().min(0), priceObjectSchema),
  currency: Joi.string().min(1),
}).min(1);

/**
 * Create a new ebook. Accepts a multer `req.file` (Cloudinary upload middleware).
 * If `req.file` is not present, will fall back to a provided coverImage in body
 * or to a static demo URL (useful for manual/testing flows).
 */
const createEbook = asyncHandler(async (req, res) => {
  const { error, value } = createSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }

  // Determine cover image: prefer uploaded file, then body.coverImageUrl, then demo static
  let coverImage;
  if (req.file) {
    coverImage = { url: req.file.path, public_id: req.file.filename };
  } else if (req.body && req.body.coverImageUrl) {
    coverImage = { url: req.body.coverImageUrl, public_id: req.body.coverImagePublicId || '' };
  } else {
    // Demo fallback (from user's provided sample)
    coverImage = {
      url: 'https://res.cloudinary.com/dzijdorge/image/upload/v1763476497/hunam_comp_x3mwck.jpg',
      public_id: 'hunam_comp_x3mwck',
    };
    console.log('No file detected in request, using demo static cover image.');
  }

  // Convert price input to the new { amount, currency } shape
  let priceObj = { amount: 0, currency: DEFAULT_CURRENCY };
  if (value.price !== undefined) {
    if (typeof value.price === 'number') {
      priceObj.amount = value.price;
      priceObj.currency = value.currency || DEFAULT_CURRENCY;
    } else if (typeof value.price === 'object' && value.price !== null) {
      priceObj.amount = Number(value.price.amount) || 0;
      priceObj.currency = value.price.currency || value.currency || DEFAULT_CURRENCY;
    }
  } else if (req.body && req.body.price !== undefined) {
    // fallback parsing from raw body (strings)
    const parsed = Number(req.body.price);
    if (!Number.isNaN(parsed)) {
      priceObj.amount = parsed;
      priceObj.currency = req.body.currency || DEFAULT_CURRENCY;
    }
  }

  const ebookData = {
    title: value.title,
    author: value.author,
    description: value.description || '',
    price: priceObj,
    coverImage,
  };

  if (!ebookData.title || !ebookData.author || !ebookData.coverImage || !ebookData.coverImage.url) {
    res.status(400);
    throw new Error('Please provide a title, author, and cover image.');
  }

  const ebook = await Ebook.create(ebookData);

  res.status(201).json({
    message: 'Ebook created successfully!',
    data: {
      _id: ebook._id,
      title: ebook.title,
      author: ebook.author,
      coverImageUrl: ebook.coverImage.url,
      createdAt: ebook.createdAt,
    },
  });
});

const getEbooks = asyncHandler(async (req, res) => {
  const ebooks = await Ebook.find({}).select('-__v').sort({ createdAt: -1 });
  res.json(ebooks);
});

const updateEbook = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error, value } = updateSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }

  const ebook = await Ebook.findById(id);
  if (!ebook) {
    res.status(404);
    throw new Error('Ebook not found');
  }

  // If new cover uploaded, replace in Cloudinary
  if (req.file) {
    try {
      await cloudinary.uploader.destroy(ebook.coverImage.public_id);
    } catch (e) {
      // non-blocking; log and continue
      console.warn('Cloudinary destroy failed:', e.message);
    }
    value.coverImage = { url: req.file.path, public_id: req.file.filename };
  }

  // Handle price updates explicitly so we maintain the object shape
  if (value.price !== undefined || req.body.price !== undefined || value.currency) {
    let priceObj = ebook.price || { amount: 0, currency: DEFAULT_CURRENCY };
    if (value.price !== undefined) {
      if (typeof value.price === 'number') {
        priceObj.amount = value.price;
        priceObj.currency = value.currency || priceObj.currency || DEFAULT_CURRENCY;
      } else if (typeof value.price === 'object' && value.price !== null) {
        priceObj.amount = Number(value.price.amount) || priceObj.amount || 0;
        priceObj.currency = value.price.currency || value.currency || priceObj.currency || DEFAULT_CURRENCY;
      }
    } else if (req.body.price !== undefined) {
      const parsed = Number(req.body.price);
      if (!Number.isNaN(parsed)) priceObj.amount = parsed;
      priceObj.currency = req.body.currency || value.currency || priceObj.currency || DEFAULT_CURRENCY;
    } else if (value.currency) {
      priceObj.currency = value.currency;
    }
    ebook.price = priceObj;
  }

  // Merge other allowed fields
  const allowed = ['title', 'author', 'description', 'coverImage'];
  for (const k of allowed) if (value[k] !== undefined) ebook[k] = value[k];
  await ebook.save();
  res.json(ebook);
});

const deleteEbook = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ebook = await Ebook.findById(id);
  if (!ebook) {
    res.status(404);
    throw new Error('Ebook not found');
  }

  try {
    await cloudinary.uploader.destroy(ebook.coverImage.public_id);
  } catch (e) {
    console.warn('Cloudinary destroy failed:', e.message);
  }

  await ebook.deleteOne();
  res.json({ message: 'Ebook deleted' });
});

module.exports = { createEbook, getEbooks, updateEbook, deleteEbook };
