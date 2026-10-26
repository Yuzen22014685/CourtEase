const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, requireRole } = require('../middleware/auth');
const { postChat } = require('../controllers/chatbotController');

const burstLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String(req.user._id),
  legacyHeaders: false,
  standardHeaders: 'draft-8',
  message: { success: false, message: 'Too many messages. Please wait a few minutes and try again.' },
});

const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 100,
  keyGenerator: (req) => String(req.user._id),
  legacyHeaders: false,
  standardHeaders: 'draft-8',
  message: { success: false, message: 'Daily chat limit reached. Please try again tomorrow.' },
});

router.post('/', protect, requireRole('player'), burstLimiter, dailyLimiter, postChat);

module.exports = router;
