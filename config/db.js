const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB_NAME;
    // If dbName provided and URI lacks a trailing path component, append it.
    if (uri && dbName && !/\/[^/?]+\?/.test(uri) && !uri.match(/mongodb.*\/(.+?)($|\?)/)) {
      // URI has no path; append db name before query params
      const parts = uri.split('?');
      uri = parts[0].endsWith('/') ? parts[0] + dbName : parts[0] + '/' + dbName;
      if (parts[1]) uri += '?' + parts[1];
    }
    const conn = await mongoose.connect(uri, {
      // recommended options (Mongoose 8 has new defaults; keep minimal)
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
