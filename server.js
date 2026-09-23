require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { startScheduler } = require('./cron/scheduler');

// Route imports
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/player');
const adminRoutes = require('./routes/admin');

const app = express();

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
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
  app.listen(PORT, () => {
    console.log(`🚀 CourtEase API running on port ${PORT}`);
    startScheduler();
  });
});

module.exports = app;
