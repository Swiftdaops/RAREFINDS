const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ownerSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  storeName: {
    type: String
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  username: {
    type: String,
    unique: true,
    sparse: true
  },
  password: { 
    type: String, 
    required: true 
  },
  type: {
    type: String,
    enum: ['author', 'bookstore'],
    required: true
  },
  bio: { 
    type: String 
  },
  whatsappNumber: {
    type: String
  },
  profileImage: {
    type: String
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  rejectionReason: { 
    type: String 
  }
}, { timestamps: true });

// Encrypt password using bcrypt
ownerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
ownerSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// CRITICAL FIX: Ensure the model name is 'Owner', not 'Admin'
// Explicitly use the 'owners' collection to avoid colliding with admin collection/indexes
module.exports = mongoose.model('Owner', ownerSchema, 'owners');
