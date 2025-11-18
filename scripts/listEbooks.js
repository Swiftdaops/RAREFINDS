require('dotenv').config();
const connectDB = require('../config/db');
const Ebook = require('../models/Ebook');

(async () => {
  try {
    await connectDB();
    const ebooks = await Ebook.find({}).sort({ createdAt: -1 });
    const out = ebooks.map(e => ({
      id: e._id,
      title: e.title,
      author: e.author,
      description: e.description,
      price: e.price && e.price.amount !== undefined ? `${e.price.currency || 'NGN'} ${e.price.amount}` : e.price,
      coverImage: e.coverImage,
      createdAt: e.createdAt,
    }));
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Failed to list ebooks:', err.message || err);
    process.exit(1);
  }
})();
