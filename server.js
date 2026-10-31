require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const privateUploads = require('./middleware/privateUploads');
const { startScheduler } = require('./cron/scheduler');
const { verifySMTP } = require('./utils/emailService');
const { checkStorageConfig } = require('./utils/storage');

// Route imports
const authRoutes = require('./routes/auth');
const chatbotRoutes = require('./routes/chatbot');
const playerRoutes = require('./routes/player');
const adminRoutes = require('./routes/admin');

const app = express();

// Behind Render's proxy, so req.ip is the real client IP (rate limits, Turnstile).
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

// ─── Middleware ─────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production' && !allowedOrigins.includes('http://localhost:5173')) {
  allowedOrigins.push('http://localhost:5173');
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: false,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', privateUploads, express.static(path.join(__dirname, 'uploads')));

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatbotRoutes);
app.use('/api', playerRoutes);
app.use('/api/admin', adminRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', service: 'CourtEase API', timestamp: new Date().toISOString() })
);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// ─── Centralized error handler (must be last) ────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  const driver = checkStorageConfig();
  console.log(`Storage: ${driver}`);
  app.listen(PORT, () => {
    console.log(`🚀 CourtEase API running on port ${PORT}`);
    startScheduler();
    verifySMTP();
  });
});

module.exports = app;
