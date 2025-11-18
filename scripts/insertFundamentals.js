// scripts/insertFundamentals.js
require('dotenv').config();
const connectDB = require('../config/db');
const Ebook = require('../models/Ebook');

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'NGN';

(async () => {
  try {
    await connectDB();

    const sample = {
      title: 'Fundamentals of Assembly Language',
      author: 'Jackson Willians',
      description: 'An essential introduction to the core concepts and architecture of Assembly language programming for systems development and optimization.',
      price: { amount: 39.99, currency: DEFAULT_CURRENCY },
      coverImage: {
        url: 'https://res.cloudinary.com/dzijdorge/image/upload/v1763476497/hunam_comp_x3mwck.jpg',
        public_id: 'fundamentals_assembly_willians_v1',
      },
    };

    // Check by title to avoid public_id conflicts
    const exists = await Ebook.findOne({ title: sample.title });
    if (exists) {
      console.log('Book already exists:', exists._id.toString());
      process.exit(0);
    }

    const ebook = await Ebook.create(sample);
    console.log('Inserted new book with id:', ebook._id.toString());
    process.exit(0);
  } catch (err) {
    console.error('Insert failed:', err.message || err);
    process.exit(1);
  }
})();
