const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  getProfile,
  updateProfile,
  verifyEmail,
  resendVerification,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many accounts created from this IP, please try again after an hour.',
  },
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification email requests from this IP, please try again after 15 minutes.',
  },
});

// POST /api/auth/register
router.post('/register', registerLimiter, register);

// POST /api/auth/login
router.post('/login', loginLimiter, login);

// GET  /api/auth/verify-email/:token
router.get('/verify-email/:token', verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', resendLimiter, resendVerification);

// GET  /api/auth/profile  — fetch current player's profile (protected)
router.get('/profile', protect, getProfile);

// PATCH /api/auth/profile — update address + bankAccount (protected)
router.patch('/profile', protect, updateProfile);

module.exports = router;
