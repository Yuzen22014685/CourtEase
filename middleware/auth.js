const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — verifies Bearer JWT and attaches user to req.user
 */
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorised, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (req.user.passwordChangedAt) {
      const tokenIssuedAtMs = decoded.iat * 1000;
      if (tokenIssuedAtMs < req.user.passwordChangedAt.getTime()) {
        return res.status(401).json({ success: false, message: 'Your password was changed. Please log in again.' });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

/**
 * Restrict route to admin role only — must be used after protect
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

module.exports = { protect, adminOnly };
