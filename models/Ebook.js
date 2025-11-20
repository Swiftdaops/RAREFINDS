const mongoose = require('mongoose');

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'NGN';

const ebookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: {
      amount: { type: Number, required: true, default: 0 },
      currency: { type: String, required: true, default: DEFAULT_CURRENCY },
    },
    coverImage: {
      url: { type: String, required: true },
      public_id: { type: String, required: true },
    },
    // Nullable for legacy admin-created ebooks; set when owners are used.
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', default: null },
    ownerStoreName: { type: String, default: '' },
    ownerWhatsapp: { type: String, default: '' },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ebook', ebookSchema);
