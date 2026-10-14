const mongoose = require('mongoose');

const courtSchema = new mongoose.Schema({
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  courtNumber: { type: Number, required: true },
  status: { type: String, enum: ['active', 'maintenance', 'inactive'], default: 'active' },
}, { timestamps: true });

// Compound index: each court number must be unique per venue
courtSchema.index({ venueId: 1, courtNumber: 1 }, { unique: true });

module.exports = mongoose.model('Court', courtSchema);
