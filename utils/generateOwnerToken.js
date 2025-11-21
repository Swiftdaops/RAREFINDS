const jwt = require('jsonwebtoken');

const generateOwnerToken = (res, payload) => {
  const token = jwt.sign(payload, process.env.OWNER_JWT_SECRET || process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  // Determine if we must set cross-site compatible cookies.
  const nodeEnv = process.env.NODE_ENV || 'development';
  const forceSecure = process.env.FORCE_SECURE_COOKIES === 'true';
  // If host is not localhost (deployment) or explicitly forced, treat as production for cookie attributes.
  const isRemote = forceSecure || nodeEnv === 'production';

  res.cookie('owner_jwt', token, {
    httpOnly: true,
    secure: isRemote,               // must be true for SameSite=None over HTTPS
    sameSite: isRemote ? 'none' : 'lax', // allow cross-site Netlify -> Render
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};

module.exports = generateOwnerToken;