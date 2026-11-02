// controllers/receiptRequestController.js
// "Ask for a new receipt": a venue owner (or admin) doubts a payment receipt but does not
// want to reject the booking outright.
//
// Rules:
// - The booking stays 'pending' and the court stays held (pending is a slot-blocking status).
// - The doubted receipt is moved to previousReceipts (kept, still private) and receiptImage is
//   cleared. The pending safety net (cron 4) therefore EXPIRES the booking at session start
//   unless the player uploads a new receipt: it can never auto-confirm on the doubted receipt.
// - One receipt covers every session paid together (same CE- paymentRef), so the request
//   applies to all pending sessions of that payment at this venue that still carry a receipt.
// - At most MAX_REQUESTS per booking, and only before the session starts; after that the
//   owner approves or rejects. Reject stays final.
// - Each booking is updated with a guarded updateOne (still pending, same receipt), so a
//   request that races an upload, an approval or a cron run changes nothing.
// - The player gets one in-app notification and one email per payment; neither can fail the request.

const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { canAccessVenue } = require('../utils/venueAccess');
const { getSessionStart } = require('../config/bookingPolicy');
const { bookingEmail } = require('../utils/notify');

const MAX_REQUESTS = 2;
const MIN_REASON = 5;
const MAX_REASON = 300;

// PATCH /api/admin/bookings/:id/request-receipt   body: { reason }
const requestNewReceipt = async (req, res, next) => {
    try {
        const { reason } = req.body || {};
        const trimmed = typeof reason === 'string' ? reason.trim() : '';
        if (trimmed.length < MIN_REASON) {
            return res.status(400).json({
                success: false,
                message: `Reason is required (minimum ${MIN_REASON} characters)`,
            });
        }
        const reasonText = trimmed.slice(0, MAX_REASON);

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        const booking = await Booking.findById(req.params.id).populate('venueId', 'name ownerId');
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        const hasAccess = await canAccessVenue(req.user, booking.venueId?._id);
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: 'You do not have access to this venue' });
        }
        if (booking.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'This booking is no longer pending.' });
        }
        if (!booking.receiptImage) {
            return res.status(409).json({ success: false, message: 'There is no receipt to replace on this booking.' });
        }
        const now = new Date();
        if (getSessionStart(booking) <= now) {
            return res.status(409).json({
                success: false,
                message: 'The session has already started. Approve or reject this booking instead.',
            });
        }
        if ((booking.receiptRequestCount || 0) >= MAX_REQUESTS) {
            return res.status(409).json({
                success: false,
                message: `A new receipt has already been requested ${MAX_REQUESTS} times for this booking. Approve or reject it instead.`,
            });
        }

        // Every pending session of the same payment at this venue that still carries a receipt
        const filter = booking.paymentRef
            ? {
                paymentRef: booking.paymentRef,
                playerId: booking.playerId,
                venueId: booking.venueId._id,
                status: 'pending',
                receiptImage: { $nin: [null, ''] },
            }
            : { _id: booking._id };
        const group = await Booking.find(filter);

        const updatedIds = [];
        for (const b of group) {
            if (getSessionStart(b) <= now) continue;
            if ((b.receiptRequestCount || 0) >= MAX_REQUESTS) continue;
            const result = await Booking.updateOne(
                { _id: b._id, status: 'pending', receiptImage: b.receiptImage },
                {
                    $push: { previousReceipts: { image: b.receiptImage, replacedAt: now } },
                    $set: {
                        paymentStatus: 'pending',
                        receiptRequest: { reason: reasonText, requestedAt: now },
                        receiptReminderSent: true, // the request itself is the reminder; stops cron 3 adding a generic one
                    },
                    $unset: { receiptImage: '' },
                    $inc: { receiptRequestCount: 1 },
                }
            );
            if (result.modifiedCount === 1) updatedIds.push(b._id);
        }

        if (updatedIds.length === 0) {
            return res.status(409).json({
                success: false,
                message: 'This booking changed while you were reviewing it. Refresh and try again.',
            });
        }

        const count = updatedIds.length;
        const notifyId = updatedIds.find((id) => id.equals(booking._id)) || updatedIds[0];
        const more = count > 1 ? ` (and ${count - 1} more session${count > 2 ? 's' : ''} in payment ${booking.paymentRef})` : '';
        const message =
            `${booking.venueId.name} asked for a new payment receipt for your booking on ${booking.date} at ${booking.startTime}${more}. ` +
            `Reason: ${reasonText}. Upload a new receipt before the session starts, otherwise the booking will expire.`;

        // Upsert: a second request refreshes the same notification instead of hitting the unique index
        try {
            await Notification.findOneAndUpdate(
                { bookingId: notifyId, type: 'receipt_requested' },
                { $set: { playerId: booking.playerId, message, isRead: false, sentAt: now } },
                { upsert: true, runValidators: true }
            );
        } catch (notifErr) {
            console.error(`[receipt-request] notification for booking ${notifyId} failed:`, notifErr.message);
        }
        bookingEmail(notifyId, 'receipt_requested', { count });

        res.json({
            success: true,
            message: count > 1 ? `New receipt requested for ${count} sessions` : 'New receipt requested',
            data: { count, bookingIds: updatedIds },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { requestNewReceipt };