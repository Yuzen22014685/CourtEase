const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Court = require('../models/Court');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const ShopItem = require('../models/ShopItem');
const {
  ALLOW_CANCEL_WITHOUT_REFUND,
  CHANGE_CUTOFF_HOURS,
  SLOT_BLOCKING_STATUSES,
  getSessionStart,
  getBookingPermissions,
  canReviewBooking,
} = require('../config/bookingPolicy');
const { getHourlyRate, computeCourtAmount, getPriceRange } = require('../utils/pricing');
const { buildAvailabilityMatrix } = require('../utils/availability');
const { signUploadPath } = require('../utils/signedUrl');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse "HH:MM" into total minutes since midnight for comparison
 */
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Compute paymentOptions boolean flags from venue.paymentInfo
 */
const computePaymentOptions = (paymentInfo) => {
  const qr = Boolean(paymentInfo?.duitNowQr && String(paymentInfo.duitNowQr).trim());
  const bank = Boolean(
    paymentInfo?.bankName && String(paymentInfo.bankName).trim() &&
    paymentInfo?.accountName && String(paymentInfo.accountName).trim() &&
    paymentInfo?.accountNumber && String(paymentInfo.accountNumber).trim()
  );
  return {
    duitNowQr: qr,
    bankTransfer: bank,
  };
};

/**
 * Generate a payment reference code: "CE-" + 6 random alphanumeric characters
 */
const generatePaymentRef = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CE-${code}`;
};

// ---------------------------------------------------------------------------
// Helper: compute average rating and count from Review collection for one or many venues.
// Returns a Map<venueId_string, { avg: number|null, count: number }>
// ---------------------------------------------------------------------------
const computeVenueRatings = async (venueIds) => {
  const agg = await Review.aggregate([
    { $match: { venueId: { $in: venueIds }, isHidden: { $ne: true } } },
    { $group: { _id: '$venueId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const row of agg) {
    map.set(row._id.toString(), {
      avg:   Math.round(row.avg * 10) / 10, // 1 decimal
      count: row.count,
    });
  }
  return map;
};

// ---------------------------------------------------------------------------
// GET /api/venues?area=Bayan+Lepas
// ---------------------------------------------------------------------------
const getVenues = async (req, res, next) => {
  try {
    const filter = { isActive: { $ne: false } };
    if (req.query.area) filter.area = req.query.area;
    const venues = await Venue.find(filter).select('-__v -reviews');

    // Attach live ratings and paymentOptions, explicitly excluding paymentInfo
    const ids = venues.map((v) => v._id);
    const ratingMap = await computeVenueRatings(ids);

    const data = venues.map((v) => {
      const plain = v.toObject();
      const r = ratingMap.get(v._id.toString());
      plain.rating         = r ? r.avg   : null;
      plain.reviewCount    = r ? r.count : 0;
      plain.paymentOptions = computePaymentOptions(plain.paymentInfo);
      delete plain.paymentInfo;
      const { priceFrom, priceTo } = getPriceRange(plain);
      plain.priceFrom      = priceFrom;
      plain.priceTo        = priceTo;
      return plain;
    });

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/venues/:id
// ---------------------------------------------------------------------------
const getVenueById = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id).select('-__v -reviews');
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });

    // Live rating from Review collection, explicitly excluding paymentInfo
    const ratingMap = await computeVenueRatings([venue._id]);
    const plain = venue.toObject();
    const r = ratingMap.get(venue._id.toString());
    plain.rating         = r ? r.avg   : null;
    plain.reviewCount    = r ? r.count : 0;
    plain.paymentOptions = computePaymentOptions(plain.paymentInfo);
    delete plain.paymentInfo;
    const { priceFrom, priceTo } = getPriceRange(plain);
    plain.priceFrom      = priceFrom;
    plain.priceTo        = priceTo;

    res.json({ success: true, data: plain });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/venues/:id/availability?date=YYYY-MM-DD
// Returns a slot matrix: for each court → each hourly slot → booked or available
// Only SLOT_BLOCKING_STATUSES count as occupying a slot (cancelled & rejected are free).
// ---------------------------------------------------------------------------
const getVenueAvailability = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD)' });
    }

    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });

    const matrix = await buildAvailabilityMatrix(venue, date);

    res.json({ success: true, date, venueId: venue._id, matrix });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/bookings
// ---------------------------------------------------------------------------
const createBooking = async (req, res, next) => {
  try {
    const { venueId, courtId, date, startTime, endTime, paymentMethod, paymentRef, items } = req.body;

    // Validate slot format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
    }
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return res.status(400).json({ success: false, message: 'startTime and endTime must be HH:MM' });
    }
    if (toMinutes(startTime) >= toMinutes(endTime)) {
      return res.status(400).json({ success: false, message: 'startTime must be before endTime' });
    }

    // ── Past-slot guard ──────────────────────────────────────────────────────
    const slotStart = new Date(`${date}T${startTime}:00+08:00`);
    if (slotStart <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This time slot has already passed and cannot be booked.',
      });
    }
    // ────────────────────────────────────────────────────────────────────────

    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
    if (venue.isActive === false) {
      return res.status(400).json({ success: false, message: 'This venue is currently inactive and cannot be booked' });
    }

    // Validate venue payment setup
    const paymentOptions = computePaymentOptions(venue.paymentInfo);
    if (!paymentOptions.duitNowQr && !paymentOptions.bankTransfer) {
      return res.status(400).json({
        success: false,
        message: "This venue hasn't set up payment details yet.",
      });
    }

    if (!['duitnow_qr', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Only DuitNow QR and Bank Transfer are accepted.',
      });
    }

    if (paymentMethod === 'duitnow_qr' && !paymentOptions.duitNowQr) {
      return res.status(400).json({
        success: false,
        message: 'DuitNow QR is not available for this venue.',
      });
    }

    if (paymentMethod === 'bank_transfer' && !paymentOptions.bankTransfer) {
      return res.status(400).json({
        success: false,
        message: 'Bank transfer is not available for this venue.',
      });
    }

    const court = await Court.findOne({ _id: courtId, venueId, status: 'active' });
    if (!court) return res.status(404).json({ success: false, message: 'Court not found or under maintenance' });

    // Conflict check — only SLOT_BLOCKING_STATUSES count (cancelled & rejected do not block)
    const conflict = await Booking.findOne({
      courtId,
      date,
      status: { $in: SLOT_BLOCKING_STATUSES },
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      ],
    });
    if (conflict) {
      return res.status(409).json({ success: false, message: 'Court is already booked for this time slot' });
    }

    // Shared payment reference handling
    let finalPaymentRef = paymentRef ? String(paymentRef).trim() : null;
    if (finalPaymentRef) {
      const existingRefBooking = await Booking.findOne({
        paymentRef: finalPaymentRef,
        playerId: req.user._id,
        venueId,
        status: 'pending',
      });
      if (!existingRefBooking) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment reference for this venue and player.',
        });
      }
    } else {
      finalPaymentRef = generatePaymentRef();
    }

    // ── Items validation & snapshotting ──────────────────────────────────────
    let processedItems = [];
    let itemsTotal = 0;

    if (items !== undefined && items !== null) {
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, message: 'items must be an array' });
      }

      if (items.length > 0) {
        if (paymentRef) {
          return res.status(400).json({
            success: false,
            message: 'Shop items can only be added to the initial booking',
          });
        }

        if (items.length > 20) {
          return res.status(400).json({
            success: false,
            message: 'Cannot order more than 20 item lines',
          });
        }

        const itemIds = [];
        for (const item of items) {
          if (!item || typeof item !== 'object') {
            return res.status(400).json({ success: false, message: 'Invalid item entry' });
          }

          const { itemId, quantity, note } = item;

          if (!itemId || !mongoose.isValidObjectId(itemId)) {
            return res.status(400).json({ success: false, message: 'Invalid item ID' });
          }

          if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
            return res.status(400).json({
              success: false,
              message: 'Item quantity must be an integer between 1 and 10',
            });
          }

          if (note !== undefined && note !== null && typeof note !== 'string') {
            return res.status(400).json({ success: false, message: 'Item note must be a string' });
          }

          itemIds.push(String(itemId));
        }

        // Check for duplicates
        const uniqueIds = new Set(itemIds);
        if (uniqueIds.size !== itemIds.length) {
          return res.status(400).json({
            success: false,
            message: 'Duplicate items are not allowed in the same booking',
          });
        }

        // Fetch items from DB to verify venueId and availability
        const dbItems = await ShopItem.find({
          _id: { $in: itemIds },
          venueId,
        });

        const dbItemMap = new Map();
        for (const dbItem of dbItems) {
          dbItemMap.set(dbItem._id.toString(), dbItem);
        }

        for (const item of items) {
          const dbItem = dbItemMap.get(String(item.itemId));
          if (!dbItem) {
            const otherVenueItem = await ShopItem.findById(item.itemId);
            const itemName = otherVenueItem ? otherVenueItem.name : 'Unknown item';
            return res.status(400).json({
              success: false,
              message: `Item "${itemName}" is not available at this venue`,
            });
          }

          if (!dbItem.isAvailable) {
            return res.status(400).json({
              success: false,
              message: `Item "${dbItem.name}" is currently unavailable`,
            });
          }

          const trimmedNote = typeof item.note === 'string' ? item.note.trim().slice(0, 100) : '';

          processedItems.push({
            itemId: dbItem._id,
            name: dbItem.name,
            category: dbItem.category,
            unitPrice: dbItem.price,
            quantity: item.quantity,
            note: trimmedNote,
            readyInfo: dbItem.readyInfo || '',
          });

          itemsTotal += dbItem.price * item.quantity;
        }

        itemsTotal = Math.round(itemsTotal * 100) / 100;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const amount = computeCourtAmount(venue, date, startTime, endTime);
    const receiptId = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const booking = await Booking.create({
      playerId: req.user._id,
      venueId,
      courtId,
      date,
      startTime,
      endTime,
      paymentMethod,
      amount,
      receiptId,
      paymentRef: finalPaymentRef,
      status: 'pending',    // awaits admin approval — see approveBooking / rejectBooking
      paymentStatus: 'pending',
      items: processedItems,
      itemsTotal,
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/bookings/me
// Appends canCancel, canReschedule, canReview, and myReview.
// ---------------------------------------------------------------------------
const getMyBookings = async (req, res, next) => {
  try {
    const playerId = req.user._id;

    const bookings = await Booking.find({ playerId })
      .sort({ createdAt: -1 })
      .populate('venueId', 'name area address')
      .populate('courtId', 'courtNumber');

    // Fetch all reviews this player has written (for efficient per-booking lookup)
    const bookingIds = bookings.map((b) => b._id);
    const reviews = await Review.find({ bookingId: { $in: bookingIds }, playerId });
    const reviewsByBookingId = new Map();
    for (const rev of reviews) {
      reviewsByBookingId.set(rev.bookingId.toString(), rev);
    }

    const data = bookings.map((b) => {
      const plain = b.toObject();
      const { canCancel, canReschedule, rescheduleBlockedReason } = getBookingPermissions(plain);
      const existingReview = reviewsByBookingId.get(b._id.toString());
      const hasReview = Boolean(existingReview);
      const canReview = canReviewBooking(plain, playerId, hasReview);
      const myReview  = hasReview
        ? {
            rating: existingReview.rating,
            comment: existingReview.comment,
            isHidden: Boolean(existingReview.isHidden),
            hiddenReason: existingReview.hiddenReason ?? null,
          }
        : null;
      return { ...plain, receiptImage: signUploadPath(plain.receiptImage), canCancel, canReschedule, rescheduleBlockedReason, canReview, myReview };
    });

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/bookings/:id/cancel
// Cancellation policy: allowed before session starts when ALLOW_CANCEL_WITHOUT_REFUND is true.
// ---------------------------------------------------------------------------
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Ownership check
    if (booking.playerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to cancel this booking' });
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Only pending or confirmed bookings can be cancelled' });
    }

    const { canCancel } = getBookingPermissions(booking);
    if (!canCancel) {
      if (!ALLOW_CANCEL_WITHOUT_REFUND) {
        return res.status(400).json({ success: false, message: 'Cancellation is not permitted.' });
      }
      return res.status(400).json({
        success: false,
        message: 'Bookings cannot be cancelled once the session has started.',
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled', data: booking });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/bookings/:id/reschedule
// Body: { date, startTime, courtId }
// Validates: ownership, canReschedule, new slot validity, conflict, 24h window.
// ---------------------------------------------------------------------------
const rescheduleBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('venueId', '-paymentInfo -__v -reviews');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Ownership check
    if (booking.playerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised to reschedule this booking' });
    }

    // Policy check
    const { canReschedule } = getBookingPermissions(booking);
    if (!canReschedule) {
      if ((booking.rescheduleCount || 0) >= 1) {
        return res.status(400).json({
          success: false,
          message: 'Bookings can only be rescheduled once.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Bookings can only be rescheduled more than 24 hours before the session starts.',
      });
    }

    const { date: newDate, startTime: newStart, courtId: newCourtId } = req.body;

    // Basic format validation
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
    }
    if (!newStart || !/^\d{2}:\d{2}$/.test(newStart)) {
      return res.status(400).json({ success: false, message: 'startTime must be HH:MM' });
    }
    if (!newCourtId) {
      return res.status(400).json({ success: false, message: 'courtId is required' });
    }

    // Derive new end time using same duration as original booking
    const durationMins = toMinutes(booking.endTime) - toMinutes(booking.startTime);
    const newEndMins = toMinutes(newStart) + durationMins;
    const newEndH = String(Math.floor(newEndMins / 60)).padStart(2, '0');
    const newEndM = String(newEndMins % 60).padStart(2, '0');
    const newEnd = `${newEndH}:${newEndM}`;

    // New slot must not be in the past
    const newSlotStart = new Date(`${newDate}T${newStart}:00+08:00`);
    if (newSlotStart <= new Date()) {
      return res.status(400).json({ success: false, message: 'The new time slot has already passed.' });
    }

    // New slot must be more than CHANGE_CUTOFF_HOURS away (cannot move into no-change window)
    const hoursUntilNew = (newSlotStart - new Date()) / (1000 * 60 * 60);
    if (hoursUntilNew <= CHANGE_CUTOFF_HOURS) {
      return res.status(400).json({
        success: false,
        message: `You can only reschedule to a slot that is more than ${CHANGE_CUTOFF_HOURS} hours away.`,
      });
    }

    // New court must belong to the same venue and be active
    const newCourt = await Court.findOne({ _id: newCourtId, venueId: booking.venueId._id, status: 'active' });
    if (!newCourt) {
      return res.status(404).json({ success: false, message: 'Court not found or not available at this venue' });
    }

    // New slot must fit within venue operating hours
    const venue = booking.venueId;
    if (
      toMinutes(newStart) < toMinutes(venue.operatingHours.open) ||
      newEndMins > toMinutes(venue.operatingHours.close)
    ) {
      return res.status(400).json({
        success: false,
        message: `Slot must be within venue operating hours (${venue.operatingHours.open}–${venue.operatingHours.close}).`,
      });
    }

    // Conflict check — exclude the booking being rescheduled, only SLOT_BLOCKING_STATUSES count
    const conflict = await Booking.findOne({
      _id: { $ne: booking._id },
      courtId: newCourtId,
      date: newDate,
      status: { $in: SLOT_BLOCKING_STATUSES },
      $or: [
        { startTime: { $lt: newEnd }, endTime: { $gt: newStart } },
      ],
    });
    if (conflict) {
      return res.status(409).json({ success: false, message: 'That time slot is no longer available.' });
    }

    // Price check: reschedule slot cannot cost more than paid
    const newAmount = computeCourtAmount(venue, newDate, newStart, newEnd);
    if (newAmount > booking.amount + 0.005) {
      return res.status(400).json({
        success: false,
        message: `This time costs more (RM ${newAmount.toFixed(2)} vs RM ${booking.amount.toFixed(2)} paid). Please choose a slot at the same or lower price.`,
      });
    }

    // Save old values for rescheduledFrom
    const oldValues = {
      date:      booking.date,
      startTime: booking.startTime,
      endTime:   booking.endTime,
      courtId:   booking.courtId,
    };

    // Apply changes
    booking.rescheduledFrom = oldValues;
    booking.date      = newDate;
    booking.startTime = newStart;
    booking.endTime   = newEnd;
    booking.courtId   = newCourtId;
    booking.rescheduleCount = (booking.rescheduleCount || 0) + 1;
    await booking.save();

    // Create notification
    const venueName = venue.name;
    const message = `Your booking at ${venueName} was moved to ${newDate} at ${newStart}.`;
    try {
      await Notification.create({
        playerId: booking.playerId,
        bookingId: booking._id,
        type: 'booking_rescheduled',
        message,
      });
    } catch (notifErr) {
      // Notification creation failure should not fail the reschedule
      console.error('Failed to create reschedule notification:', notifErr.message);
    }

    res.json({ success: true, message: 'Booking rescheduled successfully', data: booking });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Middleware: verify booking exists, belongs to player, and is pending before multer writes file
// ---------------------------------------------------------------------------
const verifyBookingForReceiptUpload = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.playerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised to upload receipt for this booking' });
    }

    if (booking.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Receipts can only be uploaded for pending bookings.' });
    }

    req.booking = booking;
    next();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/bookings/:id/upload-receipt
// ---------------------------------------------------------------------------
const uploadReceipt = async (req, res, next) => {
  try {
    const booking = req.booking || (await Booking.findById(req.params.id));
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.playerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised to upload receipt for this booking' });
    }

    if (booking.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Receipts can only be uploaded for pending bookings.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    booking.receiptImage = '/uploads/' + req.file.filename;
    booking.paymentStatus = 'paid';
    await booking.save();

    res.json({ success: true, message: 'Receipt uploaded successfully', data: booking });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/bookings/:id/review  { rating, comment }
// ---------------------------------------------------------------------------
const createReview = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Check for existing review first (needed by canReviewBooking)
    const existingReview = await Review.findOne({ bookingId: booking._id });
    if (existingReview) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this booking' });
    }

    // Eligibility check
    if (!canReviewBooking(booking.toObject(), req.user._id, false)) {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be reviewed. It must be a completed session that belongs to you.',
      });
    }

    // Validate input
    const { rating, comment } = req.body;
    const ratingNum = Number(rating);
    if (!rating || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'rating must be an integer between 1 and 5' });
    }
    if (comment && comment.trim().length > 500) {
      return res.status(400).json({ success: false, message: 'comment must not exceed 500 characters' });
    }

    const review = await Review.create({
      venueId:   booking.venueId,
      bookingId: booking._id,
      playerId:  req.user._id,
      rating:    ratingNum,
      comment:   comment ? comment.trim() : '',
    });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this booking' });
    }
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/venues/:id/reviews?page=1
// Public — newest first, 10 per page. Reviewer shown as "First L." for privacy.
// ---------------------------------------------------------------------------
const getVenueReviews = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id).select('_id');
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });

    const PAGE_SIZE = 10;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const [reviews, total] = await Promise.all([
      Review.find({ venueId: venue._id, isHidden: { $ne: true } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate('playerId', 'fullName'),
      Review.countDocuments({ venueId: venue._id, isHidden: { $ne: true } }),
    ]);

    const data = reviews.map((r) => {
      const name = r.playerId?.fullName ?? 'Anonymous';
      const parts = name.trim().split(' ');
      const displayName =
        parts.length >= 2
          ? `${parts[0]} ${parts[parts.length - 1][0]}.`
          : parts[0];
      return {
        _id:             r._id,
        rating:          r.rating,
        comment:         r.comment,
        date:            r.createdAt,
        reviewerName:    displayName,
        verifiedBooking: true,
      };
    });

    res.json({
      success: true,
      total,
      page,
      pages:    Math.ceil(total / PAGE_SIZE),
      hasMore:  page * PAGE_SIZE < total,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/venues/:id/shop-items
// Returns available shop items for an active venue
// ---------------------------------------------------------------------------
const getPublicVenueShopItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const venue = await Venue.findById(id);
    if (!venue || venue.isActive === false) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const items = await ShopItem.find({ venueId: id, isAvailable: true })
      .select('_id name description category price photo notePrompt readyInfo')
      .sort({ category: 1, name: 1 });

    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/bookings/:id/payment-info
// Returns payment instructions and group totals for the booking's player
// ---------------------------------------------------------------------------
const getBookingPaymentInfo = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.playerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to view payment info for this booking',
      });
    }

    const venue = await Venue.findById(booking.venueId).select('name paymentInfo');
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const paymentRef = booking.paymentRef || booking.receiptId;

    // Group totals: sum of amount and count of this player's bookings with same paymentRef
    const groupFilter = {
      playerId: req.user._id,
      status: { $nin: ['cancelled', 'rejected', 'expired'] },
    };
    if (booking.paymentRef) {
      groupFilter.paymentRef = booking.paymentRef;
    } else {
      groupFilter.receiptId = booking.receiptId;
    }

    const groupBookings = await Booking.find(groupFilter).select('amount items itemsTotal');
    const courtTotal = Math.round(groupBookings.reduce((sum, b) => sum + (b.amount || 0), 0) * 100) / 100;
    const itemsTotal = Math.round(groupBookings.reduce((sum, b) => sum + (b.itemsTotal || 0), 0) * 100) / 100;
    const totalAmount = Math.round((courtTotal + itemsTotal) * 100) / 100;
    const totalCount = groupBookings.length;

    const groupItems = [];
    for (const b of groupBookings) {
      if (Array.isArray(b.items)) {
        for (const item of b.items) {
          groupItems.push({
            name: item.name,
            quantity: item.quantity,
            note: item.note || '',
            unitPrice: item.unitPrice,
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        venueName: venue.name,
        paymentInfo: {
          duitNowQr: venue.paymentInfo?.duitNowQr || '',
          bankName: venue.paymentInfo?.bankName || '',
          accountName: venue.paymentInfo?.accountName || '',
          accountNumber: venue.paymentInfo?.accountNumber || '',
        },
        paymentRef,
        status: booking.status,
        groupTotal: {
          amount: totalAmount,
          courtTotal,
          itemsTotal,
          count: totalCount,
          items: groupItems,
        },
        items: groupItems,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getVenues,
  getVenueById,
  getVenueAvailability,
  getPublicVenueShopItems,
  createBooking,
  getMyBookings,
  cancelBooking,
  rescheduleBooking,
  verifyBookingForReceiptUpload,
  uploadReceipt,
  createReview,
  getVenueReviews,
  getBookingPaymentInfo,
};

