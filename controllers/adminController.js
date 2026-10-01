const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const Notification = require('../models/Notification');

// ---------------------------------------------------------------------------
// Helper: parse "HH:MM" → minutes since midnight
// ---------------------------------------------------------------------------
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// ---------------------------------------------------------------------------
// Pending first (soonest session first, most urgent to review), then others by latest session date/time.
// ---------------------------------------------------------------------------
const sortByAdminPriority = (a, b) => {
  const aRank = a.status === 'pending' ? 0 : 1;
  const bRank = b.status === 'pending' ? 0 : 1;
  if (aRank !== bRank) return aRank - bRank;

  const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;

  if (a.status === 'pending') {
    const dateDiff = (a.date || '').localeCompare(b.date || '');
    if (dateDiff !== 0) return dateDiff;

    const timeDiff = (a.startTime || '').localeCompare(b.startTime || '');
    if (timeDiff !== 0) return timeDiff;

    return aCreated - bCreated;
  }

  const dateDiff = (b.date || '').localeCompare(a.date || '');
  if (dateDiff !== 0) return dateDiff;

  const timeDiff = (b.startTime || '').localeCompare(a.startTime || '');
  if (timeDiff !== 0) return timeDiff;

  return bCreated - aCreated;
};

// ---------------------------------------------------------------------------
// Shared helper: build the Mongo filter for analytics queries.
// Includes only active bookings (pending / confirmed / completed),
// within [sinceStr, todayStr] on the booking date field.
// ---------------------------------------------------------------------------
const buildAnalyticsBookingFilter = (venueId, sinceStr, todayStr) => {
  const filter = {
    status: { $in: ['pending', 'confirmed', 'completed'] },
    date: { $gte: sinceStr, $lte: todayStr },
  };
  if (venueId) filter.venueId = venueId;
  return filter;
};

// ---------------------------------------------------------------------------
// GET /api/admin/bookings/pending-count
// Returns the count of bookings with status 'pending'
// ---------------------------------------------------------------------------
const getPendingCount = async (req, res, next) => {
  try {
    const count = await Booking.countDocuments({ status: 'pending' });
    res.json({ success: true, count });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/bookings?status=&venueId=&date=&sortBy=
// ---------------------------------------------------------------------------
const getAllBookings = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.venueId) filter.venueId = req.query.venueId;
    if (req.query.date) filter.date = req.query.date;

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .populate('playerId', 'fullName email phone')
      .populate('venueId', 'name area')
      .populate('courtId', 'courtNumber');

    if (req.query.sortBy === 'priority') {
      bookings.sort(sortByAdminPriority);
    }

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/revenue?days=30
// Returns total and per-venue revenue over the last N days
// ---------------------------------------------------------------------------
const getRevenueAnalytics = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const venues = await Venue.find({});

    const results = await Promise.all(
      venues.map(async (venue) => {
        const bookings = await Booking.find(
          buildAnalyticsBookingFilter(venue._id, sinceStr, todayStr)
        );

        // bookingCount = all active bookings in the window
        const bookingCount = bookings.length;
        // totalRevenue = only paid bookings
        const totalRevenue = bookings
          .filter((b) => b.paymentStatus === 'paid')
          .reduce((sum, b) => sum + b.amount, 0);

        return {
          venueId: venue._id,
          venueName: venue.name,
          area: venue.area,
          totalRevenue,
          bookingCount,
        };
      })
    );

    // Sort by revenue descending
    results.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const grandTotal = results.reduce((sum, r) => sum + r.totalRevenue, 0);

    res.json({
      success: true,
      period: `Last ${days} days`,
      grandTotalRevenue: grandTotal,
      data: results,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/peak-hours?days=30
// Returns booking count bucketed by hour of day
// ---------------------------------------------------------------------------
const getPeakHours = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    // venueId is optional — pass undefined when absent so the helper omits it
    const venueId = req.query.venueId || undefined;
    const bookings = await Booking.find(
      buildAnalyticsBookingFilter(venueId, sinceStr, todayStr)
    ).select('startTime endTime');

    // Count bookings per hour bucket
    const hourCounts = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${String(i).padStart(2, '0')}:00`,
      bookings: 0,
    }));

    for (const b of bookings) {
      const startH = Math.floor(toMinutes(b.startTime) / 60);
      const endH = Math.ceil(toMinutes(b.endTime) / 60);
      for (let h = startH; h < endH; h++) {
        if (h < 24) hourCounts[h].bookings += 1;
      }
    }

    const peakHour = hourCounts.reduce((max, h) => (h.bookings > max.bookings ? h : max), hourCounts[0]);

    res.json({
      success: true,
      period: `Last ${days} days`,
      peakHour: peakHour.label,
      data: hourCounts.slice(7, 23),
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/utilization?days=30
// Returns court utilization % per venue (booked hours / available hours)
// ---------------------------------------------------------------------------
const getUtilization = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const venues = await Venue.find({});

    const results = await Promise.all(
      venues.map(async (venue) => {
        const bookings = await Booking.find(
          buildAnalyticsBookingFilter(venue._id, sinceStr, todayStr)
        ).select('startTime endTime');

        const bookedMinutes = bookings.reduce(
          (sum, b) => sum + (toMinutes(b.endTime) - toMinutes(b.startTime)),
          0
        );
        const bookedHours = bookedMinutes / 60;

        const openMinutes = toMinutes(venue.operatingHours.close) - toMinutes(venue.operatingHours.open);
        const totalAvailableHours = (openMinutes / 60) * venue.numberOfCourts * days;
        const utilizationPct = totalAvailableHours > 0 ? ((bookedHours / totalAvailableHours) * 100).toFixed(1) : '0.0';

        return {
          venueId: venue._id,
          venueName: venue.name,
          area: venue.area,
          numberOfCourts: venue.numberOfCourts,
          bookedHours: parseFloat(bookedHours.toFixed(1)),
          totalAvailableHours: parseFloat(totalAvailableHours.toFixed(1)),
          utilizationPct: parseFloat(utilizationPct),
        };
      })
    );

    results.sort((a, b) => b.utilizationPct - a.utilizationPct);
    res.json({ success: true, period: `Last ${days} days`, data: results });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/bookings/:id/approve
// Approves a pending booking
// ---------------------------------------------------------------------------
const approveBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('venueId', 'name');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This booking is no longer pending.' });
    }

    booking.status = 'confirmed';
    await booking.save();

    await Notification.create({
      playerId: booking.playerId,
      bookingId: booking._id,
      type: 'booking_approved',
      message: `Your booking for ${booking.venueId.name} on ${booking.date} at ${booking.startTime} has been approved!`,
    });

    res.json({ success: true, message: 'Booking approved', data: booking });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/bookings/:id/reject
// Rejects a pending booking
// ---------------------------------------------------------------------------
const rejectBooking = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

    if (!trimmedReason || trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required (minimum 5 characters)',
      });
    }

    const booking = await Booking.findById(req.params.id).populate('venueId', 'name');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This booking is no longer pending.' });
    }

    booking.status = 'rejected';
    booking.paymentStatus = 'not_verified';
    booking.rejectionReason = trimmedReason.slice(0, 300);
    await booking.save();

    await Notification.create({
      playerId: booking.playerId,
      bookingId: booking._id,
      type: 'booking_rejected',
      message: `Your booking for ${booking.venueId.name} on ${booking.date} at ${booking.startTime} was rejected because the payment could not be verified. Reason: ${trimmedReason}`,
    });

    res.json({ success: true, message: 'Booking rejected', data: booking });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPendingCount,
  getAllBookings,
  getRevenueAnalytics,
  getPeakHours,
  getUtilization,
  approveBooking,
  rejectBooking,
};
