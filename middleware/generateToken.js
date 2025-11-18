// utils/generateToken.js
const jwt = require('jsonwebtoken');

const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_COOKIE_EXPIRES_IN,
  });

  res.cookie('jwt', token, {
    httpOnly: true, // Prevents client-side JavaScript access (security!)
    secure: process.env.NODE_ENV !== 'development', // Set to true in production (HTTPS)
    sameSite: 'strict', // Protects against Cross-Site Request Forgery
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT_COOKIE_EXPIRES_IN)
  });
};

module.exports = generateToken;