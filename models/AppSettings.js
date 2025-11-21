const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema({
  themeMode: {
    type: String,
    enum: ['light', 'dark'],
    default: 'dark',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Ensure only one document exists
appSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ themeMode: 'dark' });
  }
  return settings;
};

module.exports = mongoose.model('AppSettings', appSettingsSchema);
