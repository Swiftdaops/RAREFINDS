const asyncHandler = require('express-async-handler');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const Owner = require('../models/Owner');
const generateOwnerToken = require('../utils/generateOwnerToken');
// (Note: export list updated below – this file now defines logout)

const signupSchema = Joi.object({
  name: Joi.string().min(2).required(),
  storeName: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  // Allow optional leading + for international numbers (e.g. +2348012345678)
  whatsappNumber: Joi.string().pattern(/^\+?[0-9]{8,15}$/).required(),
  phone: Joi.string().optional(),
  bio: Joi.string().allow('').optional(),
  website: Joi.string().uri().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const signup = asyncHandler(async (req, res) => {
  const { error, value } = signupSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }
  const existing = await Owner.findOne({ email: value.email });
  if (existing) {
    res.status(409);
    throw new Error('Email already registered');
  }
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(value.password, salt);
  // Normalize whatsappNumber: strip non-digits and leading '+'
  const normalizedWhatsapp = (value.whatsappNumber || '')
    .replace(/[^0-9+]/g, '')
    .replace(/^\+/, '');
  const owner = await Owner.create({
    name: value.name,
    storeName: value.storeName,
    email: value.email,
    whatsappNumber: normalizedWhatsapp,
    phone: value.phone,
    bio: value.bio,
    website: value.website,
    passwordHash,
    status: 'pending',
  });
  res.status(201).json({
    message: 'Registration received. Your store will be reviewed by JOHNBOOKS admin.',
    ownerId: owner._id,
  });
});

const login = asyncHandler(async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }
  const owner = await Owner.findOne({ email: value.email }).select('+passwordHash');
  if (!owner) {
    res.status(401);
    throw new Error('Invalid credentials');
  }
  const match = await owner.comparePassword(value.password);
  if (!match) {
    res.status(401);
    throw new Error('Invalid credentials');
  }
  if (owner.status !== 'approved') {
    res.status(403);
    if (owner.status === 'pending') throw new Error('Your store is still pending approval.');
    if (owner.status === 'rejected') throw new Error('Your store application was rejected.');
    throw new Error('Owner not approved.');
  }
  generateOwnerToken(res, { ownerId: owner._id.toString(), role: 'owner', storeName: owner.storeName });
  res.json({
    message: 'Logged in as owner',
    owner: {
      _id: owner._id,
      name: owner.name,
      storeName: owner.storeName,
      email: owner.email,
      whatsappNumber: owner.whatsappNumber,
      status: owner.status,
    },
  });
});

const me = asyncHandler(async (req, res) => {
  // req.owner attached by requireOwner middleware
  const o = req.owner;
  res.json({
    owner: {
      _id: o._id,
      name: o.name,
      storeName: o.storeName,
      email: o.email,
      whatsappNumber: o.whatsappNumber,
      phone: o.phone,
      bio: o.bio,
      website: o.website,
      status: o.status,
      isActive: o.isActive,
      createdAt: o.createdAt,
    },
  });
});

// Owner logout: clear the owner_jwt cookie
const logout = asyncHandler(async (req, res) => {
  res.clearCookie('owner_jwt', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  res.json({ message: 'Owner logged out' });
});

module.exports = { signup, login, me, logout };