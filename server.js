const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const publicBooks = require('./routes/publicBooks');
const internalRoutes = require('./routes/internal');

dotenv.config();
connectDB();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const path = require('path');
// Allow dev origins (Vite default 5173) and legacy 3000. Use a dynamic origin checker so
// requests from the browser at 5173 are accepted and cookies work (credentials: true).
const allowedOrigins = [
	'http://localhost:3000',
	'http://localhost:5173',
	'http://localhost:5174',
];
// Allow Netlify deployed frontend origin
allowedOrigins.push('https://rarefindsinternationalbookstore.netlify.app');
// Allow Render-deployed owner frontend (used by VITE_OWNER_BACKEND_URL)
allowedOrigins.push('https://rarefinds.onrender.com');
app.use(
	cors({
		origin: (origin, cb) => {
			// Allow non-browser tools like curl/postman (no origin)
			if (!origin) return cb(null, true)
			if (allowedOrigins.indexOf(origin) !== -1) return cb(null, true)
			return cb(new Error('CORS policy: This origin is not allowed'), false)
		},
		credentials: true,
	}),
);

app.use('/api/owner/auth', authRoutes);
app.use('/api/owner/books', bookRoutes);

// Public book endpoints used by frontend search and discovery. Mount the same
// handler on multiple legacy/possible endpoints so the frontend can try them.
app.use('/api/ebooks', publicBooks);
app.use('/api/books', publicBooks);
app.use('/api/public/books', publicBooks);

// Internal endpoints used by other services (e.g. admin-backend) to sync state
app.use('/api/internal', internalRoutes);

// Serve local uploads folder at /uploads when files are saved locally (fallback when Cloudinary not configured)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.send('Owner API running'));

const PORT = process.env.PORT || 5001;

// Create HTTP server and attach Socket.IO so routes can emit events via `req.app.get('io')`
const server = http.createServer(app);

// Configure Socket.IO CORS to match Express allowed origins
const io = new Server(server, {
	cors: {
		origin: (origin, callback) => {
			// Allow non-browser tools (no origin)
			if (!origin) return callback(null, true);
			if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
			return callback(new Error('CORS policy: This origin is not allowed'));
		},
		credentials: true,
	},
});

app.set('io', io);

io.on('connection', (socket) => {
	// eslint-disable-next-line no-console
	console.log('Owner-backend Socket.IO client connected:', socket.id);
	socket.on('disconnect', (reason) => {
		// eslint-disable-next-line no-console
		console.log('Owner-backend Socket.IO client disconnected:', socket.id, reason);
	});
});

server.listen(PORT, () => console.log(`Owner server running on port ${PORT}`));
