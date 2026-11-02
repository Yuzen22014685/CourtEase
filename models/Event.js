const mongoose = require('mongoose');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Venue event (social night, clinic, open play, tournament notice).
// Informational only: does NOT block courts. Post-moderation: public immediately,
// an admin can hide it with a reason (same model as reviews).
const eventSchema = new mongoose.Schema(
    {
        venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, required: true, trim: true, maxlength: 80 },
        description: { type: String, required: true, trim: true, maxlength: 1000 },
        date: { type: String, required: true, match: DATE_RE },   // Malaysia date
        startTime: { type: String, required: true, match: TIME_RE },   // Malaysia time
        endTime: { type: String, required: true, match: TIME_RE },
        posterImage: { type: String, default: null },                    // public storage kind 'event-poster'
        howToJoin: { type: String, trim: true, maxlength: 300, default: '' },
        fee: { type: String, trim: true, maxlength: 60, default: '' },

        // Moderation (admin only)
        isHidden: { type: Boolean, default: false },
        hiddenReason: { type: String, trim: true, maxlength: 300, default: null },
        hiddenAt: { type: Date, default: null },
        hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        // Owner removed a hidden event: kept as a moderation record, never shown again
        deletedByOwnerAt: { type: Date, default: null },

        // Owner changed a hidden event after it was hidden -> waiting for admin review
        ownerUpdatedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

eventSchema.index({ venueId: 1, date: 1 });              // venue page + owner list + per-venue cap
eventSchema.index({ isHidden: 1, date: 1 });             // public Events page
eventSchema.index({ createdAt: -1 });                    // admin moderation list

module.exports = mongoose.model('Event', eventSchema);