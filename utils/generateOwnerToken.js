const jwt = require('jsonwebtoken');

const generateOwnerToken = (res, payload) => {
  const token = jwt.sign(payload, process.env.OWNER_JWT_SECRET, {
    expiresIn: '7d',
  });

  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('owner_jwt', token, {
    httpOnly: true,
    secure: isProd,          // true on Render (HTTPS)
    sameSite: isProd ? 'none' : 'lax', 
    path: '/',
  });

  return token;
};

module.exports = generateOwnerToken;