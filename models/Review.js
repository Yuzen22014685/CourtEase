const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  venueId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  playerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:    { type: Number, required: true, min: 1, max: 5, integer: true },
  comment:   { type: String, trim: true, maxlength: 500, default: '' },
  createdAt: { type: Date, default: Date.now },
});

// Fast lookups
reviewSchema.index({ venueId: 1, createdAt: -1 });
reviewSchema.index({ playerId: 1 });

module.exports = mongoose.model('Review', reviewSchema);
