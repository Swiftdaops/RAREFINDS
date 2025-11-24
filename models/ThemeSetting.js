const mongoose = require('mongoose');

const ThemeSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    themeMode: { type: String, enum: ['light', 'dark'], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ThemeSetting', ThemeSettingSchema);
