const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET  /api/auth/profile  — fetch current player's profile (protected)
router.get('/profile', protect, getProfile);

// PATCH /api/auth/profile — update address + bankAccount (protected)
router.patch('/profile', protect, updateProfile);

module.exports = router;
