const mongoose = require('mongoose');

const operatingHoursSchema = new mongoose.Schema({
  open: { type: String, required: true },   // e.g. "07:00"
  close: { type: String, required: true },  // e.g. "23:00"
}, { _id: false });

const locationSchema = new mongoose.Schema({
  lat: { type: Number, min: -90, max: 90 },
  lng: { type: Number, min: -180, max: 180 },
}, { _id: false });

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, default: 'Penang', trim: true },
  area: {
    type: String,
    required: true,
    trim: true,
  },
  address: { type: String, required: true, trim: true },
  description: { type: String, maxlength: 1000, default: '', trim: true },
  phone: { type: String, trim: true, default: '' },
  operatingHours: { type: operatingHoursSchema, required: true },
  numberOfCourts: { type: Number, required: true, min: 1, max: 20 },
  pricePerHour: { type: Number, required: true, min: 0.01 },
  location: { type: locationSchema, default: undefined },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  photos: [{ type: String }],
  facilities: [{ type: String }],
  isActive: { type: Boolean, default: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviews: [{
    reviewerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    date: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

module.exports = mongoose.model('Venue', venueSchema);

