const Booking = require('../models/Booking');
const { orderSummaryEmail } = require('../utils/notify');

const REF_RE = /^CE-[A-Z0-9]{6}$/;

// ---------------------------------------------------------------------------
// POST /api/bookings/orders/:paymentRef/summary-email
// Called by the client once, after the last session of a checkout is created.
// At most one summary per order: the order's FIRST booking is claimed atomically
// (summaryEmailSentAt null -> now), so repeated or parallel calls send nothing.
// Only the player who owns the order can trigger it.
// ---------------------------------------------------------------------------
const requestOrderSummaryEmail = async (req, res, next) => {
  try {
    const paymentRef = String(req.params.paymentRef || '').trim();
    if (!REF_RE.test(paymentRef)) {
      return res.status(400).json({ success: false, message: 'Invalid payment reference' });
    }

    const first = await Booking.findOne({ paymentRef, playerId: req.user._id })
      .sort({ createdAt: 1 })
      .select('_id');
    if (!first) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const claimed = await Booking.findOneAndUpdate(
      { _id: first._id, summaryEmailSentAt: null },
      { $set: { summaryEmailSentAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!claimed) {
      return res.json({ success: true, sent: false, message: 'Summary already sent for this order' });
    }

    orderSummaryEmail(paymentRef, req.user._id); // background, never throws
    res.status(202).json({ success: true, sent: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { requestOrderSummaryEmail };
