// middleware/security.js
const cors = require('cors');
const helmet = require('helmet');

function securityMiddleware(app) {
  const allowedOrigins = [
    'http://localhost:5173',          // Vite dev
    'https://rarefinds.netlify.app',  // your Netlify frontend (change to your real URL)
    'https://rarefindsinternationalbookstore.netlify.app', // additional Netlify frontend
    'https://your-custom-domain.com', // if you map your own domain
  ];

  app.use(
    cors({
      origin(origin, callback) {
        // Allow no-origin requests (like curl / Postman / health checks)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked from origin: ${origin}`), false);
      },
      credentials: true, // 🔥 allow cookies
    })
  );

  // Security middlewares AFTER CORS
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // You can also add rate-limiting here if needed
}

module.exports = securityMiddleware;
