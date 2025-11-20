const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const Owner = require('../models/Owner');

// Base parser: decodes owner_jwt and attaches payload + owner doc
const requireOwner = asyncHandler(async (req, res, next) => {
  const token = req.cookies && req.cookies.owner_jwt;
  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no owner token');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'owner') {
      res.status(403);
      throw new Error('Invalid owner role');
    }
    const owner = await Owner.findById(decoded.ownerId).select('+passwordHash');
    if (!owner) {
      res.status(401);
      throw new Error('Owner not found');
    }
    if (owner.status !== 'approved') {
      res.status(403);
      throw new Error('Owner not approved');
    }
    req.owner = owner;
    req.auth = decoded;
    next();
  } catch (e) {
    res.status(401);
    throw new Error('Owner token invalid');
  }
});

module.exports = { requireOwner };