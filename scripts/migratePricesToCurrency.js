// scripts/migratePricesToCurrency.js
// Safely migrate existing numeric `price` fields to `{ amount, currency }`.
// Usage: node scripts/migratePricesToCurrency.js --dry
//        node scripts/migratePricesToCurrency.js

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

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'NGN';

(async () => {
  const args = parseArgs();
  const dry = !!args.dry;
  try {
    await connectDB();
    console.log('Connected. Scanning ebooks for numeric prices or missing price.amount...');

    const ebooks = await Ebook.find({});
    let toUpdate = [];
    for (const e of ebooks) {
      // Scenario A: legacy numeric price stored as Number
      // Scenario B: price is object but amount missing
      const p = e.price;
      if (p === undefined || p === null) {
        // treat as zero
        toUpdate.push({ id: e._id, old: p, new: { amount: 0, currency: DEFAULT_CURRENCY } });
      } else if (typeof p === 'number') {
        toUpdate.push({ id: e._id, old: p, new: { amount: p, currency: DEFAULT_CURRENCY } });
      } else if (typeof p === 'object' && (p.amount === undefined || p.amount === null)) {
        const amount = Number(p.amount) || 0;
        const currency = p.currency || DEFAULT_CURRENCY;
        toUpdate.push({ id: e._id, old: p, new: { amount, currency } });
      }
    }

    if (toUpdate.length === 0) {
      console.log('No ebooks require migration.');
      process.exit(0);
    }

    console.log(`Found ${toUpdate.length} ebooks to migrate.`);
    for (const item of toUpdate) {
      console.log(`- ${item.id}: ${JSON.stringify(item.old)} => ${JSON.stringify(item.new)}`);
    }

    if (dry) {
      console.log('\nDry run enabled. No changes were made.');
      process.exit(0);
    }

    console.log('\nStarting migration...');
    for (const item of toUpdate) {
      await Ebook.updateOne({ _id: item.id }, { $set: { price: item.new } });
      console.log(`Migrated ${item.id}`);
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  }
})();
