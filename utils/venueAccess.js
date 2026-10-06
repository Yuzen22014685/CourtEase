const mongoose = require('mongoose');
const Venue = require('../models/Venue');

/**
 * Returns:
 * - null for admin (meaning "all venues")
 * - array of ObjectId for venue_owner (venues with ownerId = user._id)
 * - [] for any other role or unauthenticated user
 */
const getOwnedVenueIds = async (user) => {
  if (!user) return [];
  if (user.role === 'admin') return null;
  if (user.role === 'venue_owner') {
    const venues = await Venue.find({ ownerId: user._id }).select('_id');
    return venues.map((v) => v._id);
  }
  return [];
};

/**
 * Returns:
 * - true for admin
 * - for venue_owner: true only if that venue's ownerId equals user._id
 * - false otherwise
 */
const canAccessVenue = async (user, venueId) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'venue_owner') return false;

  if (!venueId) return false;

  // If venueId is already a populated Venue document or object with ownerId
  if (typeof venueId === 'object' && venueId !== null && venueId.ownerId !== undefined) {
    if (!venueId.ownerId) return false;
    return venueId.ownerId.toString() === user._id.toString();
  }

  // If venueId is an ObjectId or string
  const rawId = venueId._id || venueId;
  if (!mongoose.isValidObjectId(rawId)) return false;

  const exists = await Venue.exists({ _id: rawId, ownerId: user._id });
  return Boolean(exists);
};

/**
 * Express middleware that validates venue ownership for route params (default: :id)
 */
const requireVenueAccess = (paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const venueId = req.params[paramName];
      if (!venueId || !mongoose.isValidObjectId(venueId)) {
        return res.status(404).json({ success: false, message: 'Venue not found' });
      }

      const venue = await Venue.findById(venueId);
      if (!venue) {
        return res.status(404).json({ success: false, message: 'Venue not found' });
      }

      const hasAccess = await canAccessVenue(req.user, venue._id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'You do not have access to this venue' });
      }

      req.venue = venue;
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  getOwnedVenueIds,
  canAccessVenue,
  requireVenueAccess,
};
