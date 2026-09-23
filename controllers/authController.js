const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Generate a signed JWT for a given user id
 */
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
const register = async (req, res, next) => {
  try {
    const { fullName, gender, address, phone, email, password, skillLevel } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ fullName, gender, address, phone, email, password, skillLevel });

    res.status(201).json({
      success: true,
      data: {
        _id:         user._id,
        fullName:    user.fullName,
        email:       user.email,
        role:        user.role,
        gender:      user.gender,
        phone:       user.phone,
        skillLevel:  user.skillLevel,
        address:     user.address,
        bankAccount: user.bankAccount,
        token:       generateToken(user._id),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({
      success: true,
      data: {
        _id:         user._id,
        fullName:    user.fullName,
        email:       user.email,
        role:        user.role,
        gender:      user.gender,
        phone:       user.phone,
        skillLevel:  user.skillLevel,
        address:     user.address,
        bankAccount: user.bankAccount,
        token:       generateToken(user._id),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/auth/profile  (protected)
// ---------------------------------------------------------------------------
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/auth/profile  (protected)
// Allowed fields: fullName, gender, phone, skillLevel, address, bankAccount
// Silently ignores: email, password, role (security — never writable here)
// ---------------------------------------------------------------------------
const updateProfile = async (req, res, next) => {
  try {
    // Explicitly destructure only the fields we allow — anything else is ignored
    const { fullName, gender, phone, skillLevel, address, bankAccount } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Enum validation (model will also reject, but we return a clear message)
    const GENDERS     = ['Male', 'Female'];
    const SKILL_LEVELS = ['Beginner', 'Pro', 'Athlete'];

    if (gender     !== undefined && !GENDERS.includes(gender)) {
      return res.status(400).json({ success: false, message: `gender must be one of: ${GENDERS.join(', ')}` });
    }
    if (skillLevel !== undefined && !SKILL_LEVELS.includes(skillLevel)) {
      return res.status(400).json({ success: false, message: `skillLevel must be one of: ${SKILL_LEVELS.join(', ')}` });
    }

    if (fullName    !== undefined) user.fullName    = fullName.trim();
    if (gender      !== undefined) user.gender      = gender;
    if (phone       !== undefined) user.phone       = phone.trim();
    if (skillLevel  !== undefined) user.skillLevel  = skillLevel;
    if (address     !== undefined) user.address     = address;
    if (bankAccount !== undefined) user.bankAccount = bankAccount;

    await user.save();

    res.json({
      success: true,
      data: {
        _id:        user._id,
        fullName:   user.fullName,
        email:      user.email,
        role:       user.role,
        gender:     user.gender,
        phone:      user.phone,
        skillLevel: user.skillLevel,
        address:    user.address,
        bankAccount: user.bankAccount,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getProfile, updateProfile };
