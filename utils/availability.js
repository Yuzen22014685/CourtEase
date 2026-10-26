// utils/availability.js — shared slot-matrix builder.
// Used by GET /api/venues/:id/availability AND by the chatbot's check_availability tool,
// so the venue page and the assistant always agree on which slots are free.

const Court = require('../models/Court');
const Booking = require('../models/Booking');
const { SLOT_BLOCKING_STATUSES } = require('../config/bookingPolicy');
const { getHourlyRate } = require('./pricing');

// "HH:MM" -> minutes since midnight
const toMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

// Hourly slots between open and close (e.g. 07:00 -> 23:00)
const generateSlots = (open, close) => {
    const slots = [];
    let current = toMinutes(open);
    const end = toMinutes(close);
    while (current < end) {
        const h = String(Math.floor(current / 60)).padStart(2, '0');
        const m = String(current % 60).padStart(2, '0');
        const next = current + 60;
        const hNext = String(Math.floor(next / 60)).padStart(2, '0');
        const mNext = String(next % 60).padStart(2, '0');
        slots.push({ start: `${h}:${m}`, end: `${hNext}:${mNext}` });
        current = next;
    }
    return slots;
};

// venue: Venue document or lean object with _id, operatingHours, pricePerHour, pricingRules.
// date: 'YYYY-MM-DD'.
// Returns the matrix array: one entry per active/maintenance court, each with hourly slots.
// Only SLOT_BLOCKING_STATUSES occupy a slot (cancelled, rejected, expired are free).
const buildAvailabilityMatrix = async (venue, date) => {
    const courts = await Court.find({
        venueId: venue._id,
        status: { $in: ['active', 'maintenance'] },
    }).sort('courtNumber');
    const bookings = await Booking.find({
        venueId: venue._id,
        date,
        status: { $in: SLOT_BLOCKING_STATUSES },
    });

    const slots = generateSlots(venue.operatingHours.open, venue.operatingHours.close);

    return courts.map((court) => {
        const isMaintenance = court.status === 'maintenance';
        const courtBookings = bookings.filter((b) => b.courtId.toString() === court._id.toString());
        const slotStatus = slots.map((slot) => {
            const price = getHourlyRate(venue, date, slot.start);
            if (isMaintenance) {
                return { start: slot.start, end: slot.end, available: false, reason: 'maintenance', price };
            }
            const isBooked = courtBookings.some(
                (b) => toMinutes(b.startTime) <= toMinutes(slot.start) && toMinutes(b.endTime) > toMinutes(slot.start)
            );
            return {
                start: slot.start,
                end: slot.end,
                available: !isBooked,
                reason: isBooked ? 'booked' : null,
                price,
            };
        });
        return {
            courtId: court._id,
            courtNumber: court.courtNumber,
            status: court.status,
            slots: slotStatus,
        };
    });
};

module.exports = { buildAvailabilityMatrix, generateSlots };