const asyncHandler = require('express-async-handler');
const Joi = require('joi');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const loginSchema = Joi.object({
  username: Joi.string().min(3).required(),
  password: Joi.string().min(6).required(),
});


const seedAdmin = asyncHandler(async () => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  const existing = await User.findOne({ username });
  if (!existing) {
    await User.create({ username, password });
    console.log('Seeded admin user');
  }
});

const login = asyncHandler(async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }
  const { username, password } = value;
  const user = await User.findOne({ username }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid credentials');
  }
  generateToken(res, user._id.toString());
  res.json({ message: 'Logged in' });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
  });
  res.json({ message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { login, logout, me, seedAdmin };
