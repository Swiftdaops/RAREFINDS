const ThemeSetting = require('../models/ThemeSetting');

// POST /api/internal/theme-sync
// Body: { themeMode: 'light' | 'dark' }
exports.syncTheme = async (req, res) => {
  // Optional shared secret validation
  const secret = process.env.OWNER_SHARED_SECRET;
  if (secret) {
    const incoming = req.headers['x-internal-secret'] || '';
    if (incoming !== secret) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  const { themeMode } = req.body || {};
  if (!themeMode || !['light', 'dark'].includes(String(themeMode))) {
    return res.status(400).json({ message: 'Invalid themeMode' });
  }

  try {
    const doc = await ThemeSetting.findOneAndUpdate(
      { key: 'global-theme' },
      { themeMode },
      { new: true, upsert: true }
    ).lean();

    // eslint-disable-next-line no-console
    console.info('[internal] theme-sync persisted:', doc && doc.themeMode);

    // Broadcast to any connected Socket.IO clients if server exposes io
    const io = req.app && req.app.get && req.app.get('io');
    if (io && io.emit) {
      io.emit('theme:update', { themeMode: doc.themeMode });
    }

    return res.json({ ok: true, themeMode: doc.themeMode });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[internal] theme-sync error:', err && err.message);
    return res.status(500).json({ message: 'Internal error' });
  }
};

// GET /api/internal/theme - return current persisted theme setting
exports.getTheme = async (req, res) => {
  try {
    const doc = await ThemeSetting.findOne({ key: 'global-theme' }).lean();
    if (!doc) return res.status(404).json({ message: 'No theme set' });
    return res.json({ themeMode: doc.themeMode });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[internal] theme-get error:', err && err.message);
    return res.status(500).json({ message: 'Internal error' });
  }
};
