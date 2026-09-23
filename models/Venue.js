const mongoose = require('mongoose');

const operatingHoursSchema = new mongoose.Schema({
  open: { type: String, required: true },   // e.g. "07:00"
  close: { type: String, required: true },  // e.g. "23:00"
}, { _id: false });

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, default: 'Penang', trim: true },
  area: {
    type: String,
    required: true,
    enum: ['Bayan Lepas', 'Georgetown', 'Bukit Mertajam', 'Tanjung Bungah', 'Jelutong', 'Butterworth', 'Seberang Jaya'],
    trim: true,
  },
  address: { type: String, required: true, trim: true },
  operatingHours: { type: operatingHoursSchema, required: true },
  numberOfCourts: { type: Number, required: true, min: 1 },
  pricePerHour: { type: Number, required: true, min: 0 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  photos: [{ type: String }],
  facilities: [{ type: String }],
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviews: [{
    reviewerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    date: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

module.exports = mongoose.model('Venue', venueSchema);
