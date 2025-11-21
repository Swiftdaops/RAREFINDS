const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Read allowed origins from env (comma-separated) and normalize to an array
const rawOrigins = process.env.CORS_ALLOWED_ORIGINS || process.env.CLIENT_ORIGIN || '';
const allowedOrigins = rawOrigins.split(',').map((s) => s.trim()).filter(Boolean);

const corsOptions = {
  // Use function form so Access-Control-Allow-Origin echoes back the actual origin
  origin: function (origin, callback) {
    // Allow non-browser requests like curl/postman (no origin)
    if (!origin) return callback(null, true);
    // Log for debugging
    console.log('CORS origin:', origin);
    // In development allow localhost origins to make local frontend easier
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      if (origin && origin.includes('localhost')) return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    // Allow Netlify preview deployments (e.g. https://deploy-preview-123--rarefindsinternationalbookstore.netlify.app)
    if (origin && origin.endsWith('--rarefindsinternationalbookstore.netlify.app')) {
      return callback(null, true);
    }
    console.warn('Blocked by CORS, origin:', origin);
    // Deny explicitly (CORS middleware will send an error)
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow httpOnly cookies to be sent
};

const securityMiddleware = (app) => {
  app.use(helmet());

  // Cross-Origin Resource Sharing using CLIENT_ORIGIN
  app.use(cors(corsOptions));
  // Ensure preflight requests receive CORS headers
  app.options('*', cors(corsOptions));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(apiLimiter);
};

module.exports = securityMiddleware;
