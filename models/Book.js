const mongoose = require('mongoose');

const bookSchema = mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, enum: ['NGN', 'USD', 'EUR', 'GBP'], default: 'NGN', required: true },
  coverImage: { type: String, required: true },
  author: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Owner' },
  ownerWhatsApp: { type: String },
  description: { type: String },
  format: { type: String, enum: ['ebook', 'audiobook'], required: true },
  // category removed — use `format` / `description` or add other fields as needed
}, { timestamps: true });

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;
