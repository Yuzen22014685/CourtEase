const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} = require('../utils/emailService');
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
    const { fullName, gender, phone, email, password, skillLevel } = req.body;

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
// Allowed fields: fullName, gender, phone, skillLevel
// Silently ignores: email, password, role (security — never writable here)
// ---------------------------------------------------------------------------
const updateProfile = async (req, res, next) => {
  try {
    // Explicitly destructure only the fields we allow — anything else is ignored
    const { fullName, gender, phone, skillLevel } = req.body;

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
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const genericResponse = {
      success: true,
      message: 'If an account exists for this email, a password reset link has been sent.',
    };

    if (!email || typeof email !== 'string') {
      return res.status(200).json(genericResponse);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+passwordResetTokenHash +passwordResetExpires +passwordResetSentAt'
    );

    if (user) {
      const now = Date.now();
      const lastSent = user.passwordResetSentAt ? new Date(user.passwordResetSentAt).getTime() : 0;
      const cooldownMs = 60 * 1000; // 60 seconds

      if (now - lastSent >= cooldownMs) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetTokenHash = hashToken(rawToken);
        user.passwordResetExpires = new Date(now + 30 * 60 * 1000); // 30 minutes
        user.passwordResetSentAt = new Date(now);

        await user.save();

        try {
          await sendPasswordResetEmail(user, rawToken);
        } catch (mailErr) {
          console.error('❌ Failed to send password reset email:', mailErr.message);
        }
      }
    }

    return res.status(200).json(genericResponse);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password/:token
// ---------------------------------------------------------------------------
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ success: false, message: passwordCheck.message });
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      passwordResetTokenHash: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetTokenHash +passwordResetExpires +passwordResetSentAt');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    user.password = password;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetSentAt = undefined;
    user.passwordChangedAt = new Date(Date.now() - 1000);
    user.isEmailVerified = true;

    await user.save();

    try {
      await sendPasswordChangedEmail(user);
    } catch (mailErr) {
      console.warn('⚠️ Failed to send password changed confirmation email:', mailErr.message);
    }

    res.json({
      success: true,
      message: 'Password updated! You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Change password for the logged-in user (any role)
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ success: false, message: passwordCheck.message });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // 400, not 401: the frontend treats 401 as "session expired" and would log the user out
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (await user.matchPassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must be different from your current password.' });
    }

    user.password = newPassword; // hashed by the pre('save') hook
    // 1 s in the past: the new token below (iat in whole seconds) is accepted,
    // every older token (other devices, stolen sessions) is rejected by protect
    user.passwordChangedAt = new Date(Date.now() - 1000);
    // any pending "forgot password" link becomes useless
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetSentAt = undefined;
    await user.save({ validateModifiedOnly: true });

    try {
      await sendPasswordChangedEmail(user);
    } catch (mailErr) {
      console.warn('⚠️ Failed to send password changed confirmation email:', mailErr.message);
    }

    res.json({
      success: true,
      message: 'Password updated. For your security, any other devices signed in to your account have been signed out.',
      data: {
        _id:        user._id,
        fullName:   user.fullName,
        email:      user.email,
        role:       user.role,
        gender:     user.gender,
        phone:      user.phone,
        skillLevel: user.skillLevel,
        token:      generateToken(user._id),
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
  forgotPassword,
  resetPassword,
  changePassword,
};
