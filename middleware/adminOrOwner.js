const jwt = require('jsonwebtoken');
const Owner = require('../models/Owner');

// Middleware that permits either an admin or an approved owner.
// Sets req.admin if admin, or req.owner if owner. Otherwise 401.
module.exports = async function adminOrOwner(req, res, next) {
  const adminToken = req.cookies && req.cookies.admin_token;
  if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
      if (decoded.role === 'admin') {
        req.admin = decoded; // { role, username }
        console.log('Admin authenticated via token');
        return next();
      }
    } catch (e) {
      console.log('Admin token invalid, checking owner...');
      // fall through to owner check
    }
  }

  const ownerToken = req.cookies && req.cookies.owner_jwt;
  if (ownerToken) {
    try {
      const decoded = jwt.verify(ownerToken, process.env.OWNER_JWT_SECRET);
      if (decoded.role !== 'owner') {
        console.log('Token role is not owner:', decoded.role);
        return res.status(403).json({ error: 'Invalid owner role' });
      }
      const owner = await Owner.findById(decoded.ownerId);
      if (!owner) {
        console.log('Owner not found in DB:', decoded.ownerId);
        return res.status(401).json({ error: 'Owner not found' });
      }
      if (owner.status !== 'approved') {
        console.log('Owner not approved:', owner.email);
        return res.status(403).json({ error: 'Owner not approved' });
      }
      req.owner = owner;
      req.auth = decoded;
      console.log('Owner authenticated:', owner.email);
      return next();
    } catch (e) {
      console.error('Owner auth failed:', e.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  console.log('No valid admin or owner token found');
  return res.status(401).json({ error: 'Authentication required' });
}
