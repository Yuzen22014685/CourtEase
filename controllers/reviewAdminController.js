const Review = require('../models/Review');
const Venue = require('../models/Venue');
const Notification = require('../models/Notification');

// ---------------------------------------------------------------------------
// GET /api/admin/reviews?page=1&venueId=&status=visible|hidden
// Returns all reviews, newest first, paginated (20 per page)
// ---------------------------------------------------------------------------
const getAdminReviews = async (req, res, next) => {
  try {
    const PAGE_SIZE = 20;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const filter = {};
    if (req.query.venueId) {
      filter.venueId = req.query.venueId;
    }
    if (req.query.status === 'visible') {
      filter.isHidden = { $ne: true };
    } else if (req.query.status === 'hidden') {
      filter.isHidden = true;
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate('venueId', 'name area')
        .populate('playerId', 'fullName email')
        .populate('bookingId', 'date startTime endTime')
        .populate('hiddenBy', 'fullName email'),
      Review.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
      data: reviews,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/reviews/:id/hide { reason }
// Reason required (min 5 characters after trimming, max 300).
// Sets hidden fields and notifies player (upserting 'review_hidden' notification).
// ---------------------------------------------------------------------------
const hideReview = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

    if (!trimmedReason || trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A reason of at least 5 characters is required to hide a review',
      });
    }

    if (trimmedReason.length > 300) {
      return res.status(400).json({
        success: false,
        message: 'Reason cannot exceed 300 characters',
      });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    review.isHidden = true;
    review.hiddenReason = trimmedReason;
    review.hiddenAt = new Date();
    review.hiddenBy = req.user._id;
    await review.save();

    // Notify player
    const venue = await Venue.findById(review.venueId).select('name');
    const venueName = venue?.name || 'the venue';
    const message = `Your review for ${venueName} was hidden by the admin. Reason: ${trimmedReason}`;

    // Note unique index on { bookingId, type } — upsert so we don't duplicate on hide/restore/hide
    await Notification.findOneAndUpdate(
      { bookingId: review.bookingId, type: 'review_hidden' },
      {
        playerId: review.playerId,
        bookingId: review.bookingId,
        type: 'review_hidden',
        message,
        isRead: false,
        sentAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const updated = await Review.findById(review._id)
      .populate('venueId', 'name area')
      .populate('playerId', 'fullName email')
      .populate('bookingId', 'date startTime endTime')
      .populate('hiddenBy', 'fullName email');

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/reviews/:id/restore
// Clears hidden fields.
// ---------------------------------------------------------------------------
const restoreReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    review.isHidden = false;
    review.hiddenReason = null;
    review.hiddenAt = null;
    review.hiddenBy = null;
    await review.save();

    const updated = await Review.findById(review._id)
      .populate('venueId', 'name area')
      .populate('playerId', 'fullName email')
      .populate('bookingId', 'date startTime endTime')
      .populate('hiddenBy', 'fullName email');

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminReviews,
  hideReview,
  restoreReview,
};
