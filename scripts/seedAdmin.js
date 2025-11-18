// scripts/seedAdmin.js
// Connect to the database, then run the seedAdmin function exported from the admin controller.
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const { seedAdmin } = require('../controllers/adminController');

(async () => {
  try {
    await connectDB();
    await seedAdmin();
    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
})();
