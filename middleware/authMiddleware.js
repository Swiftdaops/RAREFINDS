const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const Owner = require('../models/Owner');

const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies.owner_jwt;
  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.owner = await Owner.findById(decoded.id).select('-password');
    if (!req.owner) {
      res.status(401);
      throw new Error('Not authorized, owner not found')
    }
    next();
  } catch (error) {
    res.status(401);
    throw new Error('Not authorized, token failed');
  }
});

module.exports = { protect };
