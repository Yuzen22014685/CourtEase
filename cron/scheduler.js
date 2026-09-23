const cron = require('node-cron');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');

// ---------------------------------------------------------------------------
// Helper: parse "YYYY-MM-DDTHH:MM:00+08:00" from booking date + time
// ---------------------------------------------------------------------------
const toBookingDate = (date, time) => new Date(`${date}T${time}:00+08:00`);

// ---------------------------------------------------------------------------
// CRON 1: Every 5 minutes — send reminder if booking starts in ~60 minutes
// ---------------------------------------------------------------------------
const reminderJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    const in55min = new Date(now.getTime() + 55 * 60 * 1000);
    const in65min = new Date(now.getTime() + 65 * 60 * 1000);

    // We'll fetch today's and tomorrow's confirmed bookings and filter in JS
    // to avoid complex date+time string querying in MongoDB
    const todayStr = now.toISOString().split('T')[0];
    const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const upcoming = await Booking.find({
      date: { $in: [todayStr, tomorrowStr] },
      status: 'confirmed',
    });

    for (const booking of upcoming) {
      const startDt = toBookingDate(booking.date, booking.startTime);

      // Check if startTime falls within the 55–65 min window
      if (startDt >= in55min && startDt <= in65min) {
        // Check if a reminder already exists for this booking
        const exists = await Notification.findOne({ bookingId: booking._id, type: 'reminder' });
        if (!exists) {
          await Notification.create({
            playerId: booking.playerId,
            bookingId: booking._id,
            type: 'reminder',
            message: `Reminder: Your court booking at ${booking.startTime} on ${booking.date} starts in about 1 hour. Get ready!`,
          });
          console.log(`[CRON] Reminder sent for booking ${booking._id}`);
        }
      }
    }
  } catch (err) {
    console.error('[CRON] Reminder job error:', err.message);
  }
}, { scheduled: false });

// ---------------------------------------------------------------------------
// CRON 2: Every 5 minutes — send feedback_request when a session just ended
// ---------------------------------------------------------------------------
const feedbackJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const recentBookings = await Booking.find({
      date: { $in: [todayStr, yesterdayStr] },
      status: { $in: ['confirmed', 'completed'] },
    });

    for (const booking of recentBookings) {
      const endDt = toBookingDate(booking.date, booking.endTime);

      // endTime passed within the last 5 minutes
      if (endDt <= now && endDt >= fiveMinutesAgo) {
        const exists = await Notification.findOne({ bookingId: booking._id, type: 'feedback_request' });
        if (!exists) {
          // Mark booking as completed
          await Booking.findByIdAndUpdate(booking._id, { status: 'completed' });

          await Notification.create({
            playerId: booking.playerId,
            bookingId: booking._id,
            type: 'feedback_request',
            message: `How was your game at court ${booking.courtId} on ${booking.date}? We'd love to hear your feedback!`,
          });
          console.log(`[CRON] Feedback request sent for booking ${booking._id}`);
        }
      }
    }
  } catch (err) {
    console.error('[CRON] Feedback job error:', err.message);
  }
}, { scheduled: false });

// ---------------------------------------------------------------------------
// CRON 3: Every 5 minutes — send receipt upload reminder if pending > 15m
// ---------------------------------------------------------------------------
const receiptReminderJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const eligibleBookings = await Booking.find({
      status: 'pending',
      paymentStatus: 'paid',
      receiptImage: { $in: [null, ''] },
      receiptReminderSent: false,
      createdAt: { $lte: fifteenMinutesAgo }
    }).populate('venueId');

    for (const booking of eligibleBookings) {
      await Notification.create({
        playerId: booking.playerId,
        bookingId: booking._id,
        type: 'receipt_reminder',
        message: `Don't forget to upload your payment receipt for your booking at ${booking.venueId?.name || 'the venue'} on ${booking.date} to get it confirmed!`,
      });
      await Booking.findByIdAndUpdate(booking._id, { receiptReminderSent: true });
      console.log(`[CRON] Receipt reminder sent for booking ${booking._id}`);
    }
  } catch (err) {
    console.error('[CRON] Receipt reminder job error:', err.message);
  }
}, { scheduled: false });

/**
 * Start all scheduled jobs.
 * Call this after MongoDB has connected.
 */
const startScheduler = () => {
  reminderJob.start();
  feedbackJob.start();
  receiptReminderJob.start();
  console.log('⏰ Cron scheduler started (reminder, feedback, and receipt reminder jobs)');
};

module.exports = { startScheduler };
