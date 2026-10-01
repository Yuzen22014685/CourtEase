const mongoose = require('mongoose');

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
  paymentStatus: {
    type: String,
    // 'refunded' is a legacy value kept only so old records stay valid; no code may write it.
    enum: ['paid', 'pending', 'not_verified', 'refunded'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'fpx', 'ewallet'],
    required: true,
  },
  amount: { type: Number, required: true },
  receiptId: { type: String, unique: true, sparse: true },
  receiptImage: { type: String },
  receiptReminderSent: { type: Boolean, default: false },
  rejectionReason: { type: String, trim: true, maxlength: 300 },
  rescheduleCount: { type: Number, default: 0 },
  rescheduledFrom: {
    date:      { type: String },
    startTime: { type: String },
    endTime:   { type: String },
    courtId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Court' },
  },
  createdAt: { type: Date, default: Date.now },
});

// Index for fast lookup by player and venue
bookingSchema.index({ playerId: 1, createdAt: -1 });
bookingSchema.index({ venueId: 1, date: 1, courtId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
