// utils/addOns.js — add-ons belong to the ORDER (all bookings sharing a paymentRef).
//
// Add-on items are stored on one booking of the order. When that booking leaves the order
// (cancelled, rejected or expired), the items move to the earliest session of the same order
// that is still active. Only when no active session is left do they stay on the leaving
// booking (forfeited; revenue rules for that status apply as before).
//
// Safety: the leaving booking is saved FIRST with its items cleared, then the items are added
// to the target. If the second step fails, the add-ons are lost (the old behaviour) — they are
// never duplicated, so revenue and commission can't be inflated.

const Booking = require('../models/Booking');

const ACTIVE_STATUSES = ['pending', 'confirmed'];

const round2 = (n) => Math.round(n * 100) / 100;

// Earliest still-active session of the same order (or null).
const findActiveSibling = async (booking) => {
    if (!booking.paymentRef) return null;
    return Booking.findOne({
        paymentRef: booking.paymentRef,
        playerId: booking.playerId,
        _id: { $ne: booking._id },
        status: { $in: ACTIVE_STATUSES },
    })
        .sort({ date: 1, startTime: 1 })
        .select('_id date startTime');
};

// Use INSTEAD of `await booking.save()` after setting the booking's new inactive status
// ('cancelled' | 'rejected' | 'expired'). Returns the booking that received the add-ons, or null.
const saveAndHandOverAddOns = async (booking) => {
    const hasItems = Array.isArray(booking.items) && booking.items.length > 0;
    const target = hasItems ? await findActiveSibling(booking) : null;

    if (!target) {
        await booking.save();
        return null;
    }

    const items = booking.items.map((it) => (typeof it.toObject === 'function' ? it.toObject() : it));
    const itemsTotal = round2(
        booking.itemsTotal ?? items.reduce((sum, it) => sum + (it.unitPrice || 0) * (it.quantity || 0), 0)
    );

    // 1) Clear on the leaving booking first (failure after this = add-ons lost, never duplicated).
    booking.items = [];
    booking.itemsTotal = 0;
    await booking.save();

    // 2) Add to the target, only if it is still active at this moment.
    const result = await Booking.updateOne(
        { _id: target._id, status: { $in: ACTIVE_STATUSES } },
        { $push: { items: { $each: items } }, $inc: { itemsTotal } }
    );

    if (result.modifiedCount !== 1) {
        console.error(`[addOns] could not hand over add-ons from ${booking._id} to ${target._id}`);
        return null;
    }
    return target;
};

module.exports = { saveAndHandOverAddOns, findActiveSibling, ACTIVE_STATUSES };