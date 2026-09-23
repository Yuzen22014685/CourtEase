const Venue = require('../models/Venue');
const Court = require('../models/Court');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const {
  CHANGE_CUTOFF_HOURS,
  SLOT_BLOCKING_STATUSES,
  getSessionStart,
  getBookingPermissions,
} = require('../config/bookingPolicy');

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
 * Generate hourly time slots between open and close (e.g. 07:00 → 23:00)
 */
const generateSlots = (open, close) => {
  const slots = [];
  let current = toMinutes(open);
  const end = toMinutes(close);
  while (current < end) {
    const h = String(Math.floor(current / 60)).padStart(2, '0');
    const m = String(current % 60).padStart(2, '0');
    const next = current + 60;
    const hNext = String(Math.floor(next / 60)).padStart(2, '0');
    const mNext = String(next % 60).padStart(2, '0');
    slots.push({ start: `${h}:${m}`, end: `${hNext}:${mNext}` });
    current = next;
  }
  return slots;
};

// ---------------------------------------------------------------------------
// GET /api/venues?area=Bayan+Lepas
// ---------------------------------------------------------------------------
const getVenues = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.area) filter.area = req.query.area;
    const venues = await Venue.find(filter).select('-__v');
    res.json({ success: true, count: venues.length, data: venues });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/venues/:id
// ---------------------------------------------------------------------------
const getVenueById = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id).select('-__v');
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
    res.json({ success: true, data: venue });
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

    const courts = await Court.find({ venueId: venue._id, status: 'active' }).sort('courtNumber');
    const bookings = await Booking.find({
      venueId: venue._id,
      date,
      status: { $in: SLOT_BLOCKING_STATUSES },
    });

    const slots = generateSlots(venue.operatingHours.open, venue.operatingHours.close);

    const matrix = courts.map((court) => {
      const courtBookings = bookings.filter((b) => b.courtId.toString() === court._id.toString());
      const slotStatus = slots.map((slot) => {
        const isBooked = courtBookings.some(
          (b) => toMinutes(b.startTime) <= toMinutes(slot.start) && toMinutes(b.endTime) > toMinutes(slot.start)
        );
        return { start: slot.start, end: slot.end, available: !isBooked };
      });
      return {
        courtId: court._id,
        courtNumber: court.courtNumber,
        slots: slotStatus,
      };
    });

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
    const { venueId, courtId, date, startTime, endTime, paymentMethod } = req.body;

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

    const hours = (toMinutes(endTime) - toMinutes(startTime)) / 60;
    const amount = hours * venue.pricePerHour;
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
      status: 'pending',    // awaits admin approval — see approveBooking / rejectBooking
      paymentStatus: 'paid',
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/bookings/me
// Appends canCancel and canReschedule so the frontend never recalculates the rule.
// ---------------------------------------------------------------------------
const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ playerId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('venueId', 'name area address')
      .populate('courtId', 'courtNumber');

    const data = bookings.map((b) => {
      const plain = b.toObject();
      const { canCancel, canReschedule } = getBookingPermissions(plain);
      return { ...plain, canCancel, canReschedule };
    });

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/bookings/:id/cancel
// Cancellation policy: only if more than CHANGE_CUTOFF_HOURS (24h) before start.
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
      return res.status(400).json({
        success: false,
        message: 'Bookings can only be cancelled more than 24 hours before the session starts.',
      });
    }

    booking.status = 'cancelled';
    booking.paymentStatus = 'refunded';
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled and refund initiated', data: booking });
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
    const booking = await Booking.findById(req.params.id).populate('venueId');
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
// POST /api/bookings/:id/upload-receipt
// ---------------------------------------------------------------------------
const uploadReceipt = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.playerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised to upload receipt for this booking' });
    }

    if (['rejected', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot upload a receipt for a rejected or cancelled booking' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    booking.receiptImage = '/uploads/' + req.file.filename;
    await booking.save();

    res.json({ success: true, message: 'Receipt uploaded successfully', data: booking });
  } catch (err) {
    next(err);
  }
};

module.exports = { getVenues, getVenueById, getVenueAvailability, createBooking, getMyBookings, cancelBooking, rescheduleBooking, uploadReceipt };
