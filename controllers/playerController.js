const Venue = require('../models/Venue');
const Court = require('../models/Court');
const Booking = require('../models/Booking');

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
      status: { $ne: 'cancelled' },
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
    // Build the slot's start as a Malaysia-time (UTC+8) Date and compare to now.
    // Uses the same pattern as the cancellation policy check in cancelBooking.
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

    // Conflict check
    const conflict = await Booking.findOne({
      courtId,
      date,
      status: { $ne: 'cancelled' },
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
// ---------------------------------------------------------------------------
const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ playerId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('venueId', 'name area address')
      .populate('courtId', 'courtNumber');
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/bookings/:id/cancel
// Cancellation policy: only if current time is > 1 hour before startTime
// ---------------------------------------------------------------------------
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Ownership check
    if (booking.playerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to cancel this booking' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    // Build Date object from booking date + startTime (Malaysia time UTC+8)
    const bookingStart = new Date(`${booking.date}T${booking.startTime}:00+08:00`);
    const now = new Date();
    const diffMs = bookingStart - now;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 1) {
      return res.status(400).json({
        success: false,
        message: `Cancellation not allowed. Bookings can only be cancelled more than 1 hour before the start time. The session begins at ${booking.startTime} on ${booking.date}.`,
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
// POST /api/bookings/:id/upload-receipt
// ---------------------------------------------------------------------------
const uploadReceipt = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.playerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised to upload receipt for this booking' });
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

module.exports = { getVenues, getVenueById, getVenueAvailability, createBooking, getMyBookings, cancelBooking, uploadReceipt };
