const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ownerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    whatsappNumber: { type: String, required: true, trim: true }, // E.164-like without '+'
    phone: { type: String, trim: true },
    bio: { type: String, trim: true },
    website: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    isActive: { type: Boolean, default: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, default: 'OWNER' },
    approvedAt: { type: Date },
    approvedBy: { type: String }, // admin username
  },
  { timestamps: true }
);

ownerSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

module.exports = mongoose.model('Owner', ownerSchema);