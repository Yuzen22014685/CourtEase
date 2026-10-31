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
  forgotPassword,
  resetPassword,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { requireTurnstile } = require('../utils/turnstile');

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

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset requests from this IP, please try again after 15 minutes.',
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset attempts from this IP, please try again after 15 minutes.',
  },
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { success: false, message: 'Too many password change attempts. Please try again in 15 minutes.' },
});

// POST /api/auth/register
router.post('/register', registerLimiter, requireTurnstile, register);

// POST /api/auth/login
router.post('/login', loginLimiter, login);

// GET  /api/auth/verify-email/:token
router.get('/verify-email/:token', verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', resendLimiter, requireTurnstile, resendVerification);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordLimiter, requireTurnstile, forgotPassword);

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', resetPasswordLimiter, resetPassword);

// GET  /api/auth/profile  — fetch current player's profile (protected)
router.get('/profile', protect, getProfile);

// PATCH /api/auth/profile — update profile details (protected)
router.patch('/profile', protect, updateProfile);

// POST /api/auth/change-password — change password for logged-in user (protected)
router.post('/change-password', protect, changePasswordLimiter, changePassword);

module.exports = router;
