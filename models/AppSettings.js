// models/AppSettings.js
import mongoose from "mongoose";

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    value: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const AppSettings =
  mongoose.models.AppSettings || mongoose.model("AppSettings", appSettingsSchema);
