const asyncHandler = require('express-async-handler');
const Owner = require('../models/Owner');
const jwt = require('jsonwebtoken');

// Login using environment variables only (no DB user needed)
const login = asyncHandler(async (req, res) => {
  let { username, password } = req.body;
  // Normalize / trim to avoid accidental whitespace issues
  if (typeof username === 'string') username = username.trim();
  if (typeof password === 'string') password = password.trim();
  const envUser = process.env.APPADMIN_USERNAME || process.env.ADMIN_USERNAME;
  const envPass = process.env.APPADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!envUser || !envPass) {
    res.status(500);
    throw new Error('Admin credentials not configured');
  }
  if (username !== envUser || password !== envPass) {
    console.warn('Admin login failed: provided=', username, ' expected=', envUser);
    res.status(401);
    throw new Error('Invalid credentials');
  }
  const token = jwt.sign({ role: 'admin', username: envUser }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_COOKIE_EXPIRES_IN || '7d',
  });
  const isSecure = process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true';
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: !!isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ message: 'Admin logged in', admin: { username: envUser } });
});

const logout = asyncHandler(async (req, res) => {
  const isSecure = process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true';
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: !!isSecure,
    sameSite: isSecure ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  if (!req.admin) {
    res.status(401);
    throw new Error('Not authenticated');
  }
  res.json({ admin: { username: req.admin.username } });
});

// --- Owner management (admin only) ---
const listOwners = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status && ['pending','approved','rejected'].includes(status)) filter.status = status;
  const owners = await Owner.find(filter).select('-passwordHash').sort({ createdAt: -1 });
  res.json(owners);
});

const approveOwner = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const owner = await Owner.findById(id);
  if (!owner) { res.status(404); throw new Error('Owner not found'); }
  owner.status = 'approved';
  owner.approvedAt = new Date();
  owner.approvedBy = (req.admin && req.admin.username) || 'admin';
  await owner.save();
  const safe = owner.toObject();
  delete safe.passwordHash;
  res.json(safe);
});

const rejectOwner = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const owner = await Owner.findById(id);
  if (!owner) { res.status(404); throw new Error('Owner not found'); }
  owner.status = 'rejected';
  owner.approvedBy = (req.admin && req.admin.username) || 'admin';
  await owner.save();
  const safe = owner.toObject();
  delete safe.passwordHash;
  res.json(safe);
});

// Permanently delete an owner (admin only). Consider cascading in future.
const deleteOwner = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const owner = await Owner.findById(id);
  if (!owner) { res.status(404); throw new Error('Owner not found'); }
  await owner.deleteOne();
  res.json({ message: 'Owner deleted', id });
});

module.exports = { login, logout, me, listOwners, approveOwner, rejectOwner, deleteOwner };
