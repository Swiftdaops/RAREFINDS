// scripts/setRemainingPricesTo3000.js
// Set all ebooks that are NOT priced at 2000 NGN to 3000 NGN.
// Usage:
//   node scripts/setRemainingPricesTo3000.js        # perform update
//   node scripts/setRemainingPricesTo3000.js --dry   # preview only

require('dotenv').config();
const connectDB = require('../config/db');
const Ebook = require('../models/Ebook');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (!arg.startsWith('--')) return;
    const eq = arg.indexOf('=');
    if (eq === -1) args[arg.slice(2)] = true;
    else args[arg.slice(2, eq)] = arg.slice(eq + 1);
  });
  return args;
}

const TARGET_AMOUNT = 3000;
const SKIP_AMOUNT = 2000; // already-correct price to keep
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'NGN';

(async () => {
  const args = parseArgs();
  const dry = !!args.dry;

  try {
    await connectDB();
    console.log('Connected — scanning ebooks...');

    // Find ebooks that do not have price.amount === SKIP_AMOUNT
    // This includes legacy numeric price fields and objects with different amounts.
    const filter = {
      $or: [
        { 'price.amount': { $exists: false } },
        { 'price.amount': { $ne: SKIP_AMOUNT } },
        { price: { $type: 'number' } },
      ],
    };

    const candidates = await Ebook.find(filter).select('title author price');
    if (candidates.length === 0) {
      console.log('No ebooks require updating — none found outside', SKIP_AMOUNT);
      process.exit(0);
    }

    console.log(`Found ${candidates.length} ebooks to update to ${DEFAULT_CURRENCY} ${TARGET_AMOUNT}:`);
    for (const c of candidates) {
      console.log(` - ${c.title} (${c._id}) current price: ${JSON.stringify(c.price)}`);
    }

    if (dry) {
      console.log('\nDry run — no changes made.');
      process.exit(0);
    }

    const res = await Ebook.updateMany(filter, { $set: { price: { amount: TARGET_AMOUNT, currency: DEFAULT_CURRENCY } } });
    console.log(`Updated ${res.modifiedCount || res.nModified || 0} ebooks to ${DEFAULT_CURRENCY} ${TARGET_AMOUNT}.`);
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message || err);
    process.exit(1);
  }
})();
