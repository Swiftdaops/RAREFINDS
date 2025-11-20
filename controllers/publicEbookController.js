const asyncHandler = require('express-async-handler');
const Ebook = require('../models/Ebook');
const Owner = require('../models/Owner');

// GET /api/public/ebooks?search=...&ownerId=...
const listPublicEbooks = asyncHandler(async (req, res) => {
  const { search, ownerId } = req.query;
  const ownerFilter = ownerId ? { ownerId } : {};

  const query = { isPublished: true, ...ownerFilter };
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { author: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  const ebooks = await Ebook.find(query)
    .populate({ path: 'ownerId', match: { status: 'approved', isActive: true }, select: 'storeName whatsappNumber status isActive' })
    .sort({ createdAt: -1 });

  // Filter out ebooks whose owner didn't match approval criteria (populate returns null)
  const filtered = ebooks.filter(e => e.ownerId); // ensure approved owner

  res.json(filtered.map(e => ({
    _id: e._id,
    title: e.title,
    author: e.author,
    description: e.description,
    price: e.price,
    coverUrl: e.coverImage?.url,
    owner: {
      _id: e.ownerId._id,
      storeName: e.ownerId.storeName,
      whatsappNumber: e.ownerId.whatsappNumber,
    },
  })));
});

module.exports = { listPublicEbooks };