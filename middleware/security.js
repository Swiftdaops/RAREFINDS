// middleware/security.js
const cors = require('cors');
const helmet = require('helmet');

function parseEnvOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS || process.env.CLIENT_ORIGIN || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function securityMiddleware(app) {
  // Merge static fallbacks + env configured origins
  const staticOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://rarefinds.netlify.app',
    'https://rarefindsinternationalbookstore.netlify.app',
  ];
  const envOrigins = parseEnvOrigins();
  const allowList = Array.from(new Set([...staticOrigins, ...envOrigins]));

  const corsOptions = {
    origin(origin, callback) {
      // Allow non-browser / server-to-server (no Origin header)
      if (!origin) return callback(null, true);
      // Development: allow any localhost:* origin quickly
      if ((process.env.NODE_ENV || 'development') !== 'production' && /localhost:\d+$/i.test(origin)) {
        return callback(null, true);
      }
      if (allowList.includes(origin)) return callback(null, true);
      console.warn('[CORS] Blocked origin:', origin, 'Allowed:', allowList.join(', '));
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };

  app.use(cors(corsOptions));
  // Preflight support
  app.options('*', cors(corsOptions));

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
}

module.exports = securityMiddleware;
