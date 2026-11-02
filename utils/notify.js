// Transactional email dispatcher.
// Every function returns immediately: the work runs after the current request with
// setImmediate, and any failure is logged, never thrown. An email problem can never
// fail or slow down a booking, an approval or a cron run.
//
// Safety switches:
//   EMAIL_REDIRECT_TO   (development only) send every email to this address instead;
//                       the real recipient is shown in the subject. Ignored when NODE_ENV=production.
//   EMAIL_SKIP_DOMAINS  comma-separated domains never emailed (default: courtease.my,
//                       the demo accounts, which have no real inbox).
// Logs never contain email addresses (PDPA): only the email kind and a record id.

const { sendEmail } = require('./emailService');
const tpl = require('./emailTemplates');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const User = require('../models/User');

const isProduction = () => process.env.NODE_ENV === 'production';
const skipDomains = () =>
  (process.env.EMAIL_SKIP_DOMAINS ?? 'courtease.my')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round2 = (n) => Math.round(n * 100) / 100;

// Who actually receives the email. null = do not send.
const resolveRecipient = (address) => {
  const email = String(address || '').trim();
  if (!email || !email.includes('@')) return null;
  const redirect = String(process.env.EMAIL_REDIRECT_TO || '').trim();
  if (!isProduction() && redirect) return { to: redirect, original: email };
  const domain = email.split('@').pop().toLowerCase();
  if (skipDomains().includes(domain)) return null;
  return { to: email, original: null };
};

const deliver = async (address, message, label) => {
  const r = resolveRecipient(address);
  if (!r) {
    console.log(`[email] skipped ${label} (no deliverable address)`);
    return;
  }
  const subject = r.original ? `[to ${r.original}] ${message.subject}` : message.subject;
  await sendEmail({ to: r.to, subject, html: message.html, text: message.text });
  console.log(`[email] sent ${label}`);
};

// Run after the current request; never throws.
const later = (label, fn) => {
  setImmediate(() => {
    Promise.resolve()
      .then(fn)
      .catch((err) => console.error(`[email] ${label} failed:`, err.message));
  });
};

// ---------------------------------------------------------------------------
// Booking emails (one session)
// ---------------------------------------------------------------------------
const loadBooking = (id) =>
  Booking.findById(id)
    .populate('playerId', 'fullName email')
    .populate('venueId', 'name address phone')
    .populate('courtId', 'courtNumber')
    .populate('rescheduledFrom.courtId', 'courtNumber');

const venueOf = (v) => ({ _id: v._id, name: v.name, address: v.address, phone: v.phone });
const sessionOf = (b) => ({
  date: b.date,
  startTime: b.startTime,
  endTime: b.endTime,
  courtNumber: b.courtId?.courtNumber,
  paymentRef: b.paymentRef,
  amount: b.amount,
});

const BOOKING_TEMPLATES = {
  confirmed: tpl.bookingConfirmed,
  rejected: tpl.bookingRejected,
  receipt_requested: tpl.receiptRequested,
  cancelled: tpl.bookingCancelled,
  rescheduled: tpl.bookingRescheduled,
  reminder: tpl.sessionReminder,
  expired: tpl.bookingExpired,
};

/**
 * bookingEmail(bookingId, kind, opts)
 * kind: confirmed | rejected | cancelled | rescheduled | reminder | expired | receipt_requested
 * opts: { auto: true } for cron auto-confirm, { byAdmin: true } for an admin cancel
 *       { count } for receipt_requested (sessions in the payment)
 */
const bookingEmail = (bookingId, kind, opts = {}) =>
  later(`${kind} ${bookingId}`, async () => {
    const build = BOOKING_TEMPLATES[kind];
    if (!build) throw new Error(`unknown booking email kind "${kind}"`);
    const b = await loadBooking(bookingId);
    if (!b || !b.playerId || !b.venueId) return;
    const from = b.rescheduledFrom && b.rescheduledFrom.date
      ? {
          date: b.rescheduledFrom.date,
          startTime: b.rescheduledFrom.startTime,
          endTime: b.rescheduledFrom.endTime,
          courtNumber: b.rescheduledFrom.courtId?.courtNumber,
        }
      : null;
    const message = build({
      playerName: b.playerId.fullName,
      venue: venueOf(b.venueId),
      session: sessionOf(b),
      reason: kind === 'receipt_requested' ? b.receiptRequest?.reason : b.rejectionReason,
      count: Number(opts.count) || 1,
      from,
      auto: Boolean(opts.auto),
      byAdmin: Boolean(opts.byAdmin),
    });
    await deliver(b.playerId.email, message, `${kind} ${bookingId}`);
  });

// ---------------------------------------------------------------------------
// Order summary (all sessions of one checkout, one CE- reference)
// The caller must already have claimed the order (summaryEmailSentAt) so it is sent once.
// ---------------------------------------------------------------------------
const orderSummaryEmail = (paymentRef, playerId) =>
  later(`order ${paymentRef}`, async () => {
    const bookings = await Booking.find({ paymentRef, playerId, status: { $in: ['pending', 'confirmed'] } })
      .sort({ date: 1, startTime: 1 })
      .populate('playerId', 'fullName email')
      .populate('venueId', 'name address phone paymentInfo')
      .populate('courtId', 'courtNumber');
    if (!bookings.length || !bookings[0].playerId || !bookings[0].venueId) return;

    const first = bookings[0];
    const venue = first.venueId;
    const pi = venue.paymentInfo || {};
    const items = bookings.flatMap((b) => b.items || []);
    const courtTotal = round2(bookings.reduce((sum, b) => sum + (b.amount || 0), 0));
    const itemsTotal = round2(bookings.reduce((sum, b) => sum + (b.itemsTotal || 0), 0));

    const message = tpl.orderSummary({
      playerName: first.playerId.fullName,
      venue: venueOf(venue),
      sessions: bookings.map(sessionOf),
      items,
      courtTotal,
      itemsTotal,
      total: round2(courtTotal + itemsTotal),
      paymentRef,
      paymentMethod: first.paymentMethod,
      bank: pi.bankName && pi.accountName && pi.accountNumber
        ? { bankName: pi.bankName, accountName: pi.accountName, accountNumber: pi.accountNumber }
        : null,
      hasQr: Boolean(pi.duitNowQr),
    });
    await deliver(first.playerId.email, message, `order ${paymentRef}`);
  });

// ---------------------------------------------------------------------------
// Owner emails
// ---------------------------------------------------------------------------

// The venue's CURRENT owner gets it (falls back to the event's author)
const eventHiddenEmail = (eventId) =>
  later(`event-hidden ${eventId}`, async () => {
    const ev = await Event.findById(eventId)
      .populate('venueId', 'name ownerId')
      .populate('createdBy', 'fullName email');
    if (!ev || !ev.isHidden) return;
    let owner = null;
    if (ev.venueId?.ownerId) owner = await User.findById(ev.venueId.ownerId).select('fullName email');
    if (!owner) owner = ev.createdBy;
    if (!owner) return;
    const message = tpl.eventHidden({
      ownerName: owner.fullName,
      venueName: ev.venueId?.name || 'your venue',
      event: { title: ev.title, date: ev.date, startTime: ev.startTime, endTime: ev.endTime },
      reason: ev.hiddenReason,
    });
    await deliver(owner.email, message, `event-hidden ${eventId}`);
  });

// One email per owner of an active venue, sent one by one in the background
const commissionChangedEmail = (before, after) =>
  later('commission-changed', async () => {
    const ownerIds = await Venue.distinct('ownerId', { ownerId: { $ne: null }, isActive: { $ne: false } });
    const owners = await User.find({ _id: { $in: ownerIds }, role: 'venue_owner' }).select('fullName email');
    for (const owner of owners) {
      try {
        await deliver(owner.email, tpl.commissionChanged({ ownerName: owner.fullName, before, after }), `commission-changed ${owner._id}`);
      } catch (err) {
        console.error(`[email] commission-changed ${owner._id} failed:`, err.message);
      }
      await sleep(300); // gentle on the provider
    }
  });

module.exports = {
  bookingEmail,
  orderSummaryEmail,
  eventHiddenEmail,
  commissionChangedEmail,
  _resolveRecipient: resolveRecipient, // exported for tests
};
