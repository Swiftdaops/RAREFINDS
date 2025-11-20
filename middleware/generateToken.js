// middleware/generateToken.js
const jwt = require('jsonwebtoken');

const generateToken = (res, userId) => {
  // Include role=admin to distinguish in downstream logic if expanded later
  const token = jwt.sign({ userId, role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_COOKIE_EXPIRES_IN,
  });

  // Determine whether to allow cross-site cookies.
  // Browsers require Secure + SameSite=None for cross-site cookies.
  const isSecure = process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true';

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: !!isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

module.exports = generateToken;