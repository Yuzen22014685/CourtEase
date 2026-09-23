const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationEmail } = require('../utils/emailService');
const { validatePassword } = require('../utils/validatePassword');

/**
 * Generate a signed JWT for a given user id
 */
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

/**
 * Compute SHA-256 hash for raw verification token
 */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
const register = async (req, res, next) => {
  try {
    const { fullName, gender, address, phone, email, password, skillLevel } = req.body;

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ success: false, message: passwordCheck.message });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Generate raw token and store only its SHA-256 hash in DB
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      fullName,
      gender,
      address,
      phone,
      email,
      password,
      skillLevel,
      isEmailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: tokenExpires,
      emailVerificationSentAt: new Date(),
    });

    let emailSent = true;
    try {
      await sendVerificationEmail(user, rawToken);
    } catch (emailErr) {
      console.error('❌ Failed to send verification email during register:', emailErr.message);
      emailSent = false;
    }

    if (emailSent) {
      return res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        emailSent: true,
      });
    } else {
      return res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        emailSent: false,
      });
    }
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

    // Check verification status AFTER password is confirmed
    if (user.isEmailVerified !== true) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.',
      });
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
// GET /api/auth/verify-email/:token
// ---------------------------------------------------------------------------
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification link is invalid or has expired.' });
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      emailVerificationTokenHash: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationTokenHash +emailVerificationExpires +emailVerificationSentAt');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Verification link is invalid or has expired.' });
    }

    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationSentAt = undefined;

    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/resend-verification
// ---------------------------------------------------------------------------
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const genericResponse = {
      success: true,
      message: 'If an unverified account exists for this email, a new verification link has been sent.',
    };

    if (!email) {
      return res.json(genericResponse);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+emailVerificationTokenHash +emailVerificationExpires +emailVerificationSentAt'
    );

    if (user && user.isEmailVerified !== true) {
      const now = Date.now();
      const lastSent = user.emailVerificationSentAt ? new Date(user.emailVerificationSentAt).getTime() : 0;
      const cooldownMs = 60 * 1000; // 60 seconds

      if (now - lastSent >= cooldownMs) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationTokenHash = hashToken(rawToken);
        user.emailVerificationExpires = new Date(now + 24 * 60 * 60 * 1000);
        user.emailVerificationSentAt = new Date(now);

        await user.save();

        try {
          await sendVerificationEmail(user, rawToken);
        } catch (mailErr) {
          console.error('❌ Failed to resend verification email:', mailErr.message);
        }
      }
    }

    return res.json(genericResponse);
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

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  verifyEmail,
  resendVerification,
};
