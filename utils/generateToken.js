const jwt = require('jsonwebtoken');

const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_COOKIE_EXPIRES_IN || '7d',
  });

  const isSecure = process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true';

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: !!isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

module.exports = generateToken;
