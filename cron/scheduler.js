const cron = require('node-cron');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { getSessionStart, getSessionEnd } = require('../config/bookingPolicy');

// ---------------------------------------------------------------------------
// Helper: parse "YYYY-MM-DDTHH:MM:00+08:00" from booking date + time
// ---------------------------------------------------------------------------
const toBookingDate = (date, time) => new Date(`${date}T${time}:00+08:00`);

// ---------------------------------------------------------------------------
// Catch-up / completion helper: mark confirmed bookings whose session ended as completed
// ---------------------------------------------------------------------------
const completePastBookings = async () => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayStr = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];

    const confirmedBookings = await Booking.find({
      status: 'confirmed',
      date: { $lte: todayStr },
    });

    let completedCount = 0;
    let feedbackCount = 0;

    for (const booking of confirmedBookings) {
      const endDt = getSessionEnd(booking);
      if (endDt > now) continue;

      const result = await Booking.updateOne(
        { _id: booking._id, status: 'confirmed' },
        { status: 'completed' }
      );

      if (result.modifiedCount === 1) {
        completedCount++;

        if (endDt >= twentyFourHoursAgo) {
          const exists = await Notification.findOne({
            bookingId: booking._id,
            type: 'feedback_request',
          });

          if (!exists) {
            try {
              await Notification.create({
                playerId: booking.playerId,
                bookingId: booking._id,
                type: 'feedback_request',
                message: `How was your game on ${booking.date}? Tap to rate & review your experience.`,
              });
              feedbackCount++;
            } catch (notifErr) {
              if (notifErr.code !== 11000) throw notifErr;
            }
          }
        }
      }
    }

    if (completedCount > 0) {
      console.log(`[cron] completed ${completedCount} past bookings (${feedbackCount} feedback requests sent)`);
    }
  } catch (err) {
    console.error('[cron] completePastBookings error:', err.message);
  }
};

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
// CRON 2: Every 5 minutes — mark past confirmed bookings as completed & request feedback
// ---------------------------------------------------------------------------
const feedbackJob = cron.schedule('*/5 * * * *', async () => {
  await completePastBookings();
}, { scheduled: false });

// ---------------------------------------------------------------------------
// CRON 3: Every 5 minutes — send receipt upload reminder if pending > 15m
// ---------------------------------------------------------------------------
const receiptReminderJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const eligibleBookings = await Booking.find({
      status: 'pending',
      paymentStatus: { $in: ['pending', 'paid'] },
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

// ---------------------------------------------------------------------------
// CRON 4: Every 5 minutes — safety net for pending bookings past their start
// ---------------------------------------------------------------------------
const runPendingSafetyNet = async () => {
  try {
    const now = new Date();
    let autoConfirmedCount = 0;
    let expiredCount = 0;

    const pendingBookings = await Booking.find({ status: 'pending' }).populate('venueId', 'name');

    for (const booking of pendingBookings) {
      const sessionStart = getSessionStart(booking);
      if (sessionStart > now) continue; // session hasn't started yet — skip

      if (booking.receiptImage) {
        // Receipt uploaded → auto-confirm
        booking.status = 'confirmed';
        booking.autoConfirmed = true;
        booking.confirmedAt = new Date();
        await booking.save();
        try {
          await Notification.create({
            playerId: booking.playerId,
            bookingId: booking._id,
            type: 'booking_auto_confirmed',
            message: `Your booking at ${booking.venueId?.name || 'the venue'} on ${booking.date} at ${booking.startTime} has been confirmed.`,
          });
        } catch (notifErr) {
          if (notifErr.code !== 11000) throw notifErr; // ignore duplicate-key; re-throw others
        }
        autoConfirmedCount++;
      } else {
        // No receipt → expire
        booking.status = 'expired';
        booking.paymentStatus = 'not_verified';
        await booking.save();
        try {
          await Notification.create({
            playerId: booking.playerId,
            bookingId: booking._id,
            type: 'booking_expired',
            message: `Your booking at ${booking.venueId?.name || 'the venue'} on ${booking.date} at ${booking.startTime} expired because no payment receipt was uploaded before the session.`,
          });
        } catch (notifErr) {
          if (notifErr.code !== 11000) throw notifErr;
        }
        expiredCount++;
      }
    }

    if (autoConfirmedCount > 0 || expiredCount > 0) {
      console.log(`⏱ Pending safety net: ${autoConfirmedCount} auto-confirmed, ${expiredCount} expired`);
    }
  } catch (err) {
    console.error('[CRON] Pending safety net error:', err.message);
  }
};

const pendingSafetyNetJob = cron.schedule('*/5 * * * *', runPendingSafetyNet, { scheduled: false });

/**
 * Start all scheduled jobs.
 * Call this after MongoDB has connected.
 */
const startScheduler = async () => {
  reminderJob.start();
  feedbackJob.start();
  receiptReminderJob.start();
  pendingSafetyNetJob.start();
  console.log('⏰ Cron scheduler started (reminder, feedback, receipt reminder, and pending safety-net jobs)');

  // Run startup catch-up: pending safety net first, then complete past bookings
  await runPendingSafetyNet();
  await completePastBookings();
};

module.exports = { startScheduler };
