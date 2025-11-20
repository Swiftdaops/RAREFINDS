const express = require('express');
const dotenv = require('dotenv');
// Load env vars immediately
dotenv.config();

const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const securityMiddleware = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { seedAdmin } = require('./controllers/adminController');

// Debug Cloudinary Config
console.log('--- Cloudinary Config Check ---');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || 'MISSING');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'MISSING');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '***' + process.env.CLOUDINARY_API_SECRET.slice(-4) : 'MISSING');
console.log('-------------------------------');

connectDB().then(() => seedAdmin()).catch(() => {});

const os = require('os');
const app = express();
app.set('trust proxy', 1);

const path = require('path');

// Core middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security
securityMiddleware(app);

// Routes
const adminRoutes = require('./routes/admin');
const ebookRoutes = require('./routes/ebook');
const ownerRoutes = require('./routes/owner');
const publicRoutes = require('./routes/public');
// App settings routes (feature: mounted under /api)
const appSettingsRoutes = require('./routes/appSettingsRoutes');
app.use('/api/admin', adminRoutes);

// Log route exports types to help debug middleware issues
console.log('adminRoutes ->', typeof adminRoutes);
console.log('ebookRoutes ->', typeof ebookRoutes);
console.log('ownerRoutes ->', typeof ownerRoutes);
console.log('publicRoutes ->', typeof publicRoutes);
console.log('appSettingsRoutes ->', typeof appSettingsRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api/ebooks', ebookRoutes); // admin-only CRUD
app.use('/api/owners', ownerRoutes); // signup/login/me
app.use('/api/public', publicRoutes); // public listing/search
// Mount app settings routes (e.g., /api/settings/...)
app.use('/api', appSettingsRoutes);

// Serve local uploads when Cloudinary is not configured
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`Local: http://localhost:${PORT}`);

	// Print non-internal IPv4 addresses so you can access the server from other devices on the LAN
	const nets = os.networkInterfaces();
	for (const name of Object.keys(nets)) {
		for (const net of nets[name]) {
			if (net.family === 'IPv4' && !net.internal) {
				console.log(`LAN:   http://${net.address}:${PORT}`);
			}
		}
	}
});
