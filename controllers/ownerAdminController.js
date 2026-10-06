const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Venue = require('../models/Venue');
const { sendOwnerInviteEmail } = require('../utils/emailService');

// ---------------------------------------------------------------------------
// GET /api/admin/owners
// List all users with role 'venue_owner' and their assigned venues
// ---------------------------------------------------------------------------
const getOwners = async (req, res, next) => {
  try {
    const owners = await User.find({ role: 'venue_owner' })
      .select('_id fullName email createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const ownerIds = owners.map((o) => o._id);
    const venues = await Venue.find({ ownerId: { $in: ownerIds } })
      .select('_id name ownerId')
      .lean();

    const venuesByOwner = new Map();
    for (const v of venues) {
      if (!v.ownerId) continue;
      const key = v.ownerId.toString();
      if (!venuesByOwner.has(key)) {
        venuesByOwner.set(key, []);
      }
      venuesByOwner.get(key).push({ _id: v._id, name: v.name });
    }

    const data = owners.map((o) => ({
      _id: o._id,
      fullName: o.fullName,
      email: o.email,
      createdAt: o.createdAt,
      venues: venuesByOwner.get(o._id.toString()) || [],
    }));

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/owners
// Create a new venue_owner user, optionally assign venues, send invite email
// ---------------------------------------------------------------------------
const createOwner = async (req, res, next) => {
  try {
    const { fullName, email, venueIds } = req.body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    // Validate venueIds upfront if provided
    let targetVenueIds = [];
    if (venueIds !== undefined && venueIds !== null) {
      if (!Array.isArray(venueIds)) {
        return res.status(400).json({ success: false, message: 'venueIds must be an array of venue IDs' });
      }

      for (const vid of venueIds) {
        if (!mongoose.Types.ObjectId.isValid(vid)) {
          return res.status(400).json({ success: false, message: `Invalid venue ID: ${vid}` });
        }
      }

      targetVenueIds = [...new Set(venueIds.map((id) => id.toString()))];
      if (targetVenueIds.length > 0) {
        const foundCount = await Venue.countDocuments({ _id: { $in: targetVenueIds } });
        if (foundCount !== targetVenueIds.length) {
          return res.status(400).json({ success: false, message: 'One or more specified venues do not exist' });
        }
      }
    }

    // Explicit check for existing email (409)
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'This email is already registered' });
    }

    // Generate random unusable password and 72-hour reset/invite token
    const rawPassword = crypto.randomBytes(32).toString('hex');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = Date.now();
    const tokenExpires = new Date(now + 72 * 60 * 60 * 1000); // 72 hours

    let user;
    try {
      user = await User.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        password: rawPassword,
        role: 'venue_owner',
        isEmailVerified: true,
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: tokenExpires,
        passwordResetSentAt: new Date(now),
      });
    } catch (saveErr) {
      if (saveErr.code === 11000) {
        return res.status(409).json({ success: false, message: 'This email is already registered' });
      }
      throw saveErr;
    }

    // Reassign venues to this new owner if any
    if (targetVenueIds.length > 0) {
      await Venue.updateMany(
        { _id: { $in: targetVenueIds } },
        { $set: { ownerId: user._id } }
      );
    }

    // Send onboarding invite email
    let emailSent = false;
    try {
      await sendOwnerInviteEmail(user, rawToken);
      emailSent = true;
    } catch (mailErr) {
      console.error('❌ Failed to send owner invite email:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      emailSent,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/owners/:id/resend-invite
// Resend the 72-hour onboarding invite email with a 60-second cooldown
// ---------------------------------------------------------------------------
const resendOwnerInvite = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid owner ID' });
    }

    const user = await User.findOne({ _id: id, role: 'venue_owner' }).select(
      '+passwordResetTokenHash +passwordResetExpires +passwordResetSentAt'
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Venue owner not found' });
    }

    const now = Date.now();
    const lastSent = user.passwordResetSentAt ? new Date(user.passwordResetSentAt).getTime() : 0;
    const cooldownMs = 60 * 1000; // 60 seconds

    if (now - lastSent < cooldownMs) {
      const remainingSec = Math.ceil((cooldownMs - (now - lastSent)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSec} second${remainingSec === 1 ? '' : 's'} before requesting another invite email.`,
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.passwordResetExpires = new Date(now + 72 * 60 * 60 * 1000);
    user.passwordResetSentAt = new Date(now);

    await user.save();

    let emailSent = false;
    try {
      await sendOwnerInviteEmail(user, rawToken);
      emailSent = true;
    } catch (mailErr) {
      console.error('❌ Failed to resend owner invite email:', mailErr.message);
    }

    res.json({
      success: true,
      message: emailSent ? 'Invite email sent successfully.' : 'Failed to send invite email.',
      emailSent,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/venues/:id/owner
// Assign or unassign an owner to/from a venue
// ---------------------------------------------------------------------------
const updateVenueOwner = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid venue ID' });
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, 'ownerId')) {
      return res.status(400).json({ success: false, message: 'ownerId is required in request body' });
    }

    const { ownerId } = req.body;
    let targetOwnerId = null;

    if (ownerId !== null) {
      if (!mongoose.Types.ObjectId.isValid(ownerId)) {
        return res.status(400).json({ success: false, message: 'Invalid owner ID' });
      }

      const ownerUser = await User.findOne({ _id: ownerId, role: 'venue_owner' });
      if (!ownerUser) {
        return res.status(400).json({ success: false, message: 'User does not exist or is not a venue owner' });
      }

      targetOwnerId = ownerUser._id;
    }

    const venue = await Venue.findById(id).select('_id name');
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    await Venue.updateOne({ _id: id }, { $set: { ownerId: targetOwnerId } });

    res.json({
      success: true,
      message: targetOwnerId ? 'Venue owner updated successfully' : 'Venue owner unassigned successfully',
      data: {
        _id: venue._id,
        name: venue.name,
        ownerId: targetOwnerId,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOwners,
  createOwner,
  resendOwnerInvite,
  updateVenueOwner,
};
