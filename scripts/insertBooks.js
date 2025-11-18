// scripts/insertBooks.js
require('dotenv').config();
const connectDB = require('../config/db');
const Ebook = require('../models/Ebook');

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'NGN';

async function insertIfMissing(sample) {
  const query = sample.coverImage && sample.coverImage.public_id
    ? { 'coverImage.public_id': sample.coverImage.public_id }
    : { title: sample.title };

  const exists = await Ebook.findOne(query);
  if (exists) {
    console.log(`Already exists: ${sample.title} (id: ${exists._id})`);
    return exists;
  }

  const ebook = await Ebook.create(sample);
  console.log(`Inserted: ${sample.title} (id: ${ebook._id})`);
  return ebook;
}

(async () => {
  try {
    await connectDB();

    const books = [
      {
        title: 'Visual Basic Essentials: A step by Step Guide for Beginners',
        author: 'Denis Rock',
        description: 'A practical, beginner-friendly guide covering the fundamentals of Visual Basic programming, user interface design, and common application development techniques.',
        price: { amount: 34.99, currency: DEFAULT_CURRENCY },
        coverImage: {
          url: 'https://res.cloudinary.com/dzijdorge/image/upload/v1763480753/WhatsApp_Image_2025-11-18_at_10.55.56_AM_ocwidb.jpg',
          public_id: 'visual_basic_essentials_denIS_2025',
        },
      },
    ];

    for (const b of books) {
      await insertIfMissing(b);
    }

    console.log('Done inserting books.');
    process.exit(0);
  } catch (err) {
    console.error('Error inserting books:', err.message || err);
    process.exit(1);
  }
})();
