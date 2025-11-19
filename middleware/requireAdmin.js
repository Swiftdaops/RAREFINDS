const jwt = require('jsonwebtoken');

// Checks for admin_token cookie, verifies JWT, ensures role === 'admin'
module.exports = function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: 'Admin login required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    req.admin = decoded; // { role, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
