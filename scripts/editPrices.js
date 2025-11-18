// scripts/editPrices.js
// Usage:
// 1) Update by id:
//    node scripts/editPrices.js --id=BOOK_ID --price=19.99
// 2) Update by title:
//    node scripts/editPrices.js --title="Book Title" --price=19.99
// 3) Bulk update from JSON file (array of { id | title, price }):
//    node scripts/editPrices.js --file=prices.json

require('dotenv').config();
const fs = require('fs');
const connectDB = require('../config/db');
const Ebook = require('../models/Ebook');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (!arg.startsWith('--')) return;
    const eq = arg.indexOf('=');
    if (eq === -1) {
      args[arg.slice(2)] = true;
    } else {
      const key = arg.slice(2, eq);
      const val = arg.slice(eq + 1);
      args[key] = val;
    }
  });
  return args;
}

async function updateById(id, price) {
  const num = Number(price);
  if (Number.isNaN(num)) throw new Error('Invalid price: ' + price);
  const currency = parseArgs().currency || process.env.DEFAULT_CURRENCY || 'NGN';
  const updated = await Ebook.findByIdAndUpdate(id, { price: { amount: num, currency } }, { new: true });
  if (!updated) console.log(`No ebook found with id ${id}`);
  else console.log(`Updated ${updated.title} (${updated._id}) -> price ${updated.price.currency} ${updated.price.amount}`);
}

async function updateByTitle(title, price) {
  const num = Number(price);
  if (Number.isNaN(num)) throw new Error('Invalid price: ' + price);
  const currency = parseArgs().currency || process.env.DEFAULT_CURRENCY || 'NGN';
  const updated = await Ebook.findOneAndUpdate({ title }, { price: { amount: num, currency } }, { new: true });
  if (!updated) console.log(`No ebook found with title "${title}"`);
  else console.log(`Updated ${updated.title} (${updated._id}) -> price ${updated.price.currency} ${updated.price.amount}`);
}

async function updateFromFile(path) {
  if (!fs.existsSync(path)) throw new Error('File not found: ' + path);
  const raw = fs.readFileSync(path, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('File must contain a JSON array');

  for (const entry of data) {
    if (entry.id) {
      const price = typeof entry.price === 'number' ? entry.price : (entry.price && entry.price.amount);
      const currency = (entry.price && entry.price.currency) || entry.currency;
      if (currency) process.argv.push(`--currency=${currency}`);
      await updateById(entry.id, price);
    } else if (entry.title) {
      const price = typeof entry.price === 'number' ? entry.price : (entry.price && entry.price.amount);
      const currency = (entry.price && entry.price.currency) || entry.currency;
      if (currency) process.argv.push(`--currency=${currency}`);
      await updateByTitle(entry.title, price);
    } else {
      console.log('Skipping entry (missing id/title):', entry);
    }
  }
}

(async () => {
  const args = parseArgs();
  try {
    await connectDB();

    if (args.file) {
      await updateFromFile(args.file);
      process.exit(0);
    }

    if (args.id && args.price) {
      await updateById(args.id, args.price);
      process.exit(0);
    }

    if (args.title && args.price) {
      await updateByTitle(args.title, args.price);
      process.exit(0);
    }

    console.log('Usage examples:');
    console.log('  node scripts/editPrices.js --id=BOOK_ID --price=19.99');
    console.log('  node scripts/editPrices.js --title="Book Title" --price=19.99');
    console.log('  node scripts/editPrices.js --file=prices.json');
    process.exit(1);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
