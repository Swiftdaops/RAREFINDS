const asyncHandler = require('express-async-handler');
const Owner = require('../models/Owner');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');

const generateToken = (res, ownerId) => {
  const token = jwt.sign({ id: ownerId }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const cookieOptions = {
    httpOnly: true,
    // Explicitly require Secure for cross-site cookies. Set unconditionally so
    // that deployed builds always include the `Secure` attribute. Use the
    // `FORCE_INSECURE_COOKIES=true` env var only for very specific local tests
    // where you need non-secure cookies (NOT recommended for production).
    secure: process.env.FORCE_INSECURE_COOKIES === 'true' ? false : true,
    // Explicitly use capitalized `None` which is the canonical value for cross-site cookies.
    sameSite: 'None',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
  // Optionally set a cookie domain in production (helps some browsers when using a CDN)
  if (process.env.COOKIE_DOMAIN && process.env.NODE_ENV === 'production') {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  res.cookie('owner_jwt', token, cookieOptions);
};

// @route POST /api/owner/auth/signup
const uploadBufferToCloudinary = (buffer, filename, folder = 'owner_profiles') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ resource_type: 'image', folder }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
};

const signup = asyncHandler(async (req, res) => {
  const { name, email, password, type, bio, storeName, whatsappNumber, username } = req.body;

  // check for existing email
  const emailExists = await Owner.findOne({ email });
  if (emailExists) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  // if username supplied, validate uniqueness
  if (username) {
    const userExists = await Owner.findOne({ username });
    if (userExists) {
      return res.status(409).json({ message: 'Username already in use' });
    }
  }

  let profileImage;
  if (req.file) {
    // Require Cloudinary for profile image uploads; do not fall back to local storage.
    const haveCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (!haveCloudinary) {
      console.error('Cloudinary not configured - profile image upload rejected');
      res.status(500);
      return res.json({ message: 'Server misconfiguration: Cloudinary not configured. Profile image uploads require Cloudinary.' });
    }

    try {
      const result = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname);
      profileImage = result.secure_url;
    } catch (e) {
      console.error('Cloudinary profile upload failed:', e && e.message ? e.message : e);
      res.status(500);
      return res.json({ message: 'Profile image upload failed' });
    }
  }

  // create a unique username fallback derived from email to avoid inserting null username
  let finalUsername = username
  if (!finalUsername) {
    let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    if (!baseUsername) baseUsername = `user${Date.now()}`;
    finalUsername = `${baseUsername}-${Date.now()}`;
  }

  try {
    const owner = await Owner.create({ name, storeName, email, username: finalUsername, password, type, bio, whatsappNumber, profileImage, status: 'pending' });
    return res.status(201).json({ message: 'Signup successful, pending approval', ownerId: owner._id, profileImage });
  } catch (err) {
    // handle duplicate key errors from MongoDB (race conditions)
    if (err && err.code === 11000) {
      const dupKey = Object.keys(err.keyValue || {})[0];
      if (dupKey === 'email') return res.status(409).json({ message: 'Email already in use' });
      if (dupKey === 'username') return res.status(409).json({ message: 'Username already in use' });
      return res.status(409).json({ message: 'Duplicate field error' });
    }
    console.error('signup error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Failed to create owner' });
  }
});

// @route POST /api/owner/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const owner = await Owner.findOne({ email });

  if (!owner) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  if (!(await owner.matchPassword(password))) {
    res.status(401);
    throw new Error('Incorrect password');
  }

  if (owner.status !== 'approved') {
    res.status(403);
    throw new Error('Account not approved yet');
  }

  // Create a token and set cookie, and also return the token in the response body
  const token = jwt.sign({ id: owner._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.FORCE_INSECURE_COOKIES === 'true' ? false : true,
    sameSite: 'None',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
  if (process.env.COOKIE_DOMAIN && process.env.NODE_ENV === 'production') {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }
  res.cookie('owner_jwt', token, cookieOptions);

  res.status(200).json({ _id: owner._id, name: owner.name, email: owner.email, type: owner.type, profileImage: owner.profileImage, token });
});

// @route GET /api/owner/auth/me
const getMe = asyncHandler(async (req, res) => {
  // `protect` middleware attaches `req.owner` (without password)
  if (!req.owner) {
    res.status(401)
    throw new Error('Not authenticated')
  }
  res.status(200).json(req.owner)
})

// @route PUT /api/owner/auth/me
// Updates the authenticated owner's profile (bio, storeName, whatsappNumber, profileImage, name)
const updateMe = asyncHandler(async (req, res) => {
  if (!req.owner) {
    res.status(401)
    throw new Error('Not authenticated')
  }

  const owner = await Owner.findById(req.owner._id);
  if (!owner) {
    res.status(404);
    throw new Error('Owner not found');
  }

  const { name, storeName, bio, whatsappNumber } = req.body;
  if (name !== undefined) owner.name = name;
  if (storeName !== undefined) owner.storeName = storeName;
  if (bio !== undefined) owner.bio = bio;
  if (whatsappNumber !== undefined) owner.whatsappNumber = whatsappNumber;

  // Allow updating profile image via multipart upload (field name: profileImage)
  if (req.file) {
    const haveCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (!haveCloudinary) {
      res.status(500);
      return res.json({ message: 'Server misconfiguration: Cloudinary not configured. Profile image uploads require Cloudinary.' });
    }

    try {
      const result = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname);
      owner.profileImage = result.secure_url;
    } catch (e) {
      console.error('Cloudinary profile upload failed:', e && e.message ? e.message : e);
      res.status(500);
      return res.json({ message: 'Profile image upload failed' });
    }
  }

  await owner.save();

  // Return the owner object without password
  const toReturn = {
    _id: owner._id,
    name: owner.name,
    email: owner.email,
    type: owner.type,
    profileImage: owner.profileImage,
    bio: owner.bio,
    whatsappNumber: owner.whatsappNumber,
    storeName: owner.storeName,
    status: owner.status,
  };

  res.status(200).json(toReturn);
});

module.exports = { signup, login, getMe, updateMe };

