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
// Shared helper: build the Mongo filter for analytics queries.
// Includes only active bookings (pending / confirmed / completed),
// within [sinceStr, todayStr] on the booking date field.
// ---------------------------------------------------------------------------
const buildAnalyticsBookingFilter = (venueId, sinceStr, todayStr) => ({
  venueId,
  status: { $in: ['pending', 'confirmed', 'completed'] },
  date: { $gte: sinceStr, $lte: todayStr },
});

// ---------------------------------------------------------------------------
// GET /api/admin/bookings?status=&venueId=&date=
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
// GET /api/admin/analytics/peak-hours?days=14
// Returns booking count bucketed by hour of day
// ---------------------------------------------------------------------------
const getPeakHours = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const query = {
      status: { $ne: 'cancelled' },
      date: { $gte: sinceStr },
    };
    if (req.query.venueId) {
      query.venueId = req.query.venueId;
    }

    const bookings = await Booking.find(query).select('startTime endTime');

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
      return res.status(400).json({ success: false, message: 'Only pending bookings can be approved' });
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
    const booking = await Booking.findById(req.params.id).populate('venueId', 'name');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending bookings can be rejected' });
    }

    booking.status = 'rejected';
    booking.paymentStatus = 'refunded';
    await booking.save();

    await Notification.create({
      playerId: booking.playerId,
      bookingId: booking._id,
      type: 'booking_rejected',
      message: `Your booking for ${booking.venueId.name} on ${booking.date} at ${booking.startTime} was rejected and your payment has been refunded.`,
    });

    res.json({ success: true, message: 'Booking rejected and refunded', data: booking });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllBookings,
  getRevenueAnalytics,
  getPeakHours,
  getUtilization,
  approveBooking,
  rejectBooking,
};
