const mongoose = require('mongoose');
const { signUploadPath } = require('../utils/signedUrl');

const bookingSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  courtId: { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true },
  date: { type: String, required: true },           // "YYYY-MM-DD"
  startTime: { type: String, required: true },      // "HH:MM"
  endTime: { type: String, required: true },        // "HH:MM"
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'rejected', 'expired'],
    default: 'pending',
  },
  autoConfirmed: { type: Boolean, default: false },
  confirmedAt: { type: Date, default: null },
  paymentStatus: {
    type: String,
    // 'refunded' is a legacy value kept only so old records stay valid; no code may write it.
    enum: ['paid', 'pending', 'not_verified', 'refunded'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'fpx', 'ewallet', 'duitnow_qr', 'bank_transfer'],
    required: true,
  },
  amount: { type: Number, required: true },
  paymentRef: { type: String, index: true },
  receiptId: { type: String, unique: true, sparse: true },
  receiptImage: { type: String },
  previousReceipts: [{ _id: false, image: { type: String }, replacedAt: { type: Date } }],
  receiptRequest: {
    type: new mongoose.Schema({
      reason: { type: String, trim: true, maxlength: 300 },
      requestedAt: { type: Date },
    }, { _id: false }),
    default: null,
  },
  receiptRequestCount: { type: Number, default: 0 },
  receiptReminderSent: { type: Boolean, default: false },
  summaryEmailSentAt: { type: Date, default: null }, // order summary email sent (set on the order's first booking)
  rejectionReason: { type: String, trim: true, maxlength: 300 },
  rescheduleCount: { type: Number, default: 0 },
  rescheduledFrom: {
    date: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    courtId: { type: mongoose.Schema.Types.ObjectId, ref: 'Court' },
  },
  items: [
    {
      _id: false,
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopItem' },
      name: { type: String, required: true },
      category: { type: String, enum: ['product', 'service'], required: true },
      unitPrice: { type: Number, required: true },
      quantity: { type: Number, required: true, min: 1, max: 10 },
      note: { type: String, maxlength: 100, default: '' },
      readyInfo: { type: String, maxlength: 60, default: '' },
    },
  ],
  itemsTotal: { type: Number, default: 0 },
}, { timestamps: true });

// Index for fast lookup by player and venue
bookingSchema.index({ playerId: 1, createdAt: -1 });
bookingSchema.index({ venueId: 1, date: 1, courtId: 1 });

// Concurrency guard (Objective 1): at most ONE slot-holding booking per court, date and start time.
// Enforced by MongoDB itself, so two simultaneous requests cannot both be stored.
// Cancelled / rejected / expired bookings are outside the filter, so they free the slot automatically.
// Keep this status list in sync with SLOT_BLOCKING_STATUSES in config/bookingPolicy.js.
bookingSchema.index(
  { courtId: 1, date: 1, startTime: 1 },
  {
    unique: true,
    name: 'uniq_active_slot',
    partialFilterExpression: { status: { $in: ['pending', 'confirmed', 'completed'] } },
  }
);

// Receipt images are private: API responses carry a short-lived signed URL, never the raw path.
bookingSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.receiptImage) ret.receiptImage = signUploadPath(ret.receiptImage);
    if (Array.isArray(ret.previousReceipts)) {
      ret.previousReceipts = ret.previousReceipts.map((r) => ({ ...r, image: signUploadPath(r.image) }));
    }
    return ret;
  },
});

module.exports = mongoose.model('Booking', bookingSchema);
