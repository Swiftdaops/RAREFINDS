const jwt = require('jsonwebtoken');

// Separate cookie for owner auth to avoid interfering with existing admin cookie flow.
module.exports = function generateOwnerToken(res, payload) {
  // payload: { ownerId, role: 'owner', storeName }
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_COOKIE_EXPIRES_IN || '7d',
  });

  const isSecure = process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true';

  res.cookie('owner_jwt', token, {
    httpOnly: true,
    secure: !!isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};