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
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'rejected'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'refunded', 'pending'],
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
  createdAt: { type: Date, default: Date.now },
});

// Index for fast lookup by player and venue
bookingSchema.index({ playerId: 1, createdAt: -1 });
bookingSchema.index({ venueId: 1, date: 1, courtId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
