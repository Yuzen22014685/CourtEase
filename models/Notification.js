const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  type: { type: String, enum: ['reminder', 'feedback_request', 'booking_approved', 'booking_rejected', 'receipt_reminder', 'booking_rescheduled', 'booking_auto_confirmed', 'booking_expired', 'review_hidden', 'receipt_requested'], required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  sentAt: { type: Date, default: Date.now },
});

// Prevent duplicate notifications for the same booking and type
notificationSchema.index({ bookingId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Notification', notificationSchema);
