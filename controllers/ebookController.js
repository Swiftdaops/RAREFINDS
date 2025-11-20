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
  console.log('--- createEbook Request Start ---');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('File:', req.file);
  console.log('Owner:', req.owner ? req.owner._id : 'No owner');
  console.log('Admin:', req.admin ? req.admin.username : 'No admin');

  const { error, value } = createSchema.validate(req.body);
  if (error) {
    console.error('Validation Error:', error.details[0].message);
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

  // Attach ownerId if request made by an owner
  if (req.owner) {
    console.log('Attaching owner data:', req.owner._id);
    ebookData.ownerId = req.owner._id;
    ebookData.ownerStoreName = req.owner.storeName || '';
    ebookData.ownerWhatsapp = req.owner.whatsappNumber || '';
  }

  if (!ebookData.title || !ebookData.author || !ebookData.coverImage || !ebookData.coverImage.url) {
    console.error('Missing required fields');
    res.status(400);
    throw new Error('Please provide a title, author, and cover image.');
  }

  let ebook;
  try {
    console.log('Creating ebook in DB...');
    ebook = await Ebook.create(ebookData);
    console.log('Ebook created:', ebook._id);
  } catch (err) {
    console.error('Ebook creation failed:', err);
    res.status(500);
    throw new Error('Database error: ' + err.message);
  }
  let ownerPayload = null;
  if (ebook.ownerId) {
    const populated = await ebook.populate({ path: 'ownerId', select: 'storeName whatsappNumber' });
    if (populated.ownerId) {
      ownerPayload = {
        storeName: populated.ownerId.storeName,
        whatsappNumber: `+${populated.ownerId.whatsappNumber.replace(/^\+/, '')}`,
      };
    }
  }

  res.status(201).json({
    message: 'Ebook created successfully!',
    ebook: {
      _id: ebook._id,
      title: ebook.title,
      author: ebook.author,
      description: ebook.description,
      price: ebook.price,
      coverImage: ebook.coverImage,
      owner: ownerPayload,
      createdAt: ebook.createdAt,
    },
  });
});

const getEbooks = asyncHandler(async (req, res) => {
  const { ownerId } = req.query;
  const filter = {};
  // If owner making request, force filter to their own ebooks
  if (req.owner) {
    filter.ownerId = req.owner._id;
  } else if (ownerId) {
    filter.ownerId = ownerId;
  }
  const ebooks = await Ebook.find(filter)
    .select('-__v')
    .sort({ createdAt: -1 })
    .populate('ownerId', 'storeName whatsappNumber status');
  const transformed = ebooks.map(e => ({
    _id: e._id,
    title: e.title,
    author: e.author,
    description: e.description,
    price: e.price,
    coverImage: e.coverImage,
    // Expose owner details directly for frontend redirect
    ownerWhatsapp: e.ownerWhatsapp || (e.ownerId ? e.ownerId.whatsappNumber : ''),
    ownerStoreName: e.ownerStoreName || (e.ownerId ? e.ownerId.storeName : ''),
    owner: e.ownerId ? {
      storeName: e.ownerId.storeName,
      whatsappNumber: `+${(e.ownerId.whatsappNumber || '').replace(/^\+/, '')}`,
      status: e.ownerId.status,
    } : null,
    createdAt: e.createdAt,
  }));
  res.json(transformed);
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

  // Owner can only update own ebook
  if (req.owner) {
    console.log('Update request by owner:', req.owner._id);
    if (!ebook.ownerId) {
      console.warn('Owner tried to update admin book');
      res.status(403);
      throw new Error('Not permitted to update global/admin ebooks');
    }
    if (ebook.ownerId.toString() !== req.owner._id.toString()) {
      console.warn('Owner tried to update another owner book');
      res.status(403);
      throw new Error('Not permitted to update this ebook');
    }
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
  console.log('--- deleteEbook Request ---');
  console.log('ID:', id);
  console.log('User:', req.owner ? `Owner ${req.owner._id}` : (req.admin ? `Admin ${req.admin.username}` : 'Unknown'));

  const ebook = await Ebook.findById(id);
  if (!ebook) {
    res.status(404);
    throw new Error('Ebook not found');
  }

  if (req.owner) {
    if (!ebook.ownerId) {
      console.warn('Owner tried to delete admin book');
      res.status(403);
      throw new Error('Not permitted to delete global/admin ebooks');
    }
    if (ebook.ownerId.toString() !== req.owner._id.toString()) {
      console.warn('Owner tried to delete another owner book');
      res.status(403);
      throw new Error('Not permitted to delete this ebook');
    }
  }

  try {
    await cloudinary.uploader.destroy(ebook.coverImage.public_id);
  } catch (e) {
    console.warn('Cloudinary destroy failed:', e.message);
  }

  await ebook.deleteOne();
  console.log('Ebook deleted successfully');
  res.json({ message: 'Ebook deleted' });
});

module.exports = { createEbook, getEbooks, updateEbook, deleteEbook };
