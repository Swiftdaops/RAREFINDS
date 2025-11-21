const asyncHandler = require('express-async-handler');
const Joi = require('joi');
const Ebook = require('../models/Ebook');
const cloudinary = require('../config/cloudinary');

const priceSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  currency: Joi.string().min(1).required(),
});

const createSchema = Joi.object({
  title: Joi.string().min(1).required(),
  author: Joi.string().min(1).required(),
  description: Joi.string().allow('').optional(),
  price: Joi.alternatives().try(Joi.number().min(0), priceSchema).required(),
  currency: Joi.string().min(1).optional(),
  isPublished: Joi.boolean().optional(),
  coverImageUrl: Joi.string().uri().optional(),
  coverImagePublicId: Joi.string().optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().min(1),
  author: Joi.string().min(1),
  description: Joi.string().allow(''),
  price: Joi.alternatives().try(Joi.number().min(0), priceSchema),
  currency: Joi.string().min(1),
  isPublished: Joi.boolean(),
  coverImageUrl: Joi.string().uri().optional(),
  coverImagePublicId: Joi.string().optional(),
}).min(1);

const listOwnerEbooks = asyncHandler(async (req, res) => {
  const ebooks = await Ebook.find({ ownerId: req.owner._id }).sort({ createdAt: -1 });
  res.json(ebooks);
});

const createOwnerEbook = asyncHandler(async (req, res) => {
  // Debug info to help diagnose 500s in development
  console.log('createOwnerEbook: owner=', req.owner && req.owner._id ? req.owner._id.toString() : req.owner)
  console.log('createOwnerEbook: file=', req.file)
  console.log('createOwnerEbook: body keys=', Object.keys(req.body || {}))

  const { error, value } = createSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }

  let coverImage;
  if (req.file) {
    coverImage = { url: req.file.path, public_id: req.file.filename };
  } else if (req.body.coverImageUrl) {
    coverImage = { url: req.body.coverImageUrl, public_id: req.body.coverImagePublicId || '' };
  } else {
    res.status(400);
    throw new Error('Cover image required');
  }

  let priceObj;
  if (typeof value.price === 'number') {
    priceObj = { amount: value.price, currency: value.currency || process.env.DEFAULT_CURRENCY || 'NGN' };
  } else if (typeof value.price === 'object') {
    priceObj = { amount: Number(value.price.amount) || 0, currency: value.price.currency || value.currency || process.env.DEFAULT_CURRENCY || 'NGN' };
  }

  const ebook = await Ebook.create({
    title: value.title,
    author: value.author,
    description: value.description || '',
    price: priceObj,
    coverImage,
    ownerId: req.owner._id,
    isPublished: value.isPublished !== undefined ? value.isPublished : true,
  });

  res.status(201).json({ message: 'Ebook created', id: ebook._id });
});

const updateOwnerEbook = asyncHandler(async (req, res) => {
  const { error, value } = updateSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }
  const ebook = await Ebook.findOne({ _id: req.params.id, ownerId: req.owner._id });
  if (!ebook) {
    res.status(404);
    throw new Error('Ebook not found');
  }
  if (req.file) {
    try { await cloudinary.uploader.destroy(ebook.coverImage.public_id); } catch (e) {}
    ebook.coverImage = { url: req.file.path, public_id: req.file.filename };
  } else if (value.coverImageUrl) {
    ebook.coverImage = { url: value.coverImageUrl, public_id: value.coverImagePublicId || ebook.coverImage.public_id };
  }
  if (value.price !== undefined || value.currency) {
    let priceObj = ebook.price || { amount: 0, currency: process.env.DEFAULT_CURRENCY || 'NGN' };
    if (typeof value.price === 'number') {
      priceObj.amount = value.price;
      priceObj.currency = value.currency || priceObj.currency;
    } else if (typeof value.price === 'object') {
      priceObj.amount = Number(value.price.amount) || priceObj.amount;
      priceObj.currency = value.price.currency || value.currency || priceObj.currency;
    }
    ebook.price = priceObj;
  }
  ['title','author','description','isPublished'].forEach(k => { if (value[k] !== undefined) ebook[k] = value[k]; });
  await ebook.save();
  res.json({ message: 'Ebook updated', ebook });
});

const deleteOwnerEbook = asyncHandler(async (req, res) => {
  const ebook = await Ebook.findOne({ _id: req.params.id, ownerId: req.owner._id });
  if (!ebook) {
    res.status(404);
    throw new Error('Ebook not found');
  }
  try { await cloudinary.uploader.destroy(ebook.coverImage.public_id); } catch (e) {}
  await ebook.deleteOne();
  res.json({ message: 'Ebook deleted' });
});

module.exports = { listOwnerEbooks, createOwnerEbook, updateOwnerEbook, deleteOwnerEbook };