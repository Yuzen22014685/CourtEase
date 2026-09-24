/**
 * config/bookingPolicy.js
 * Single source of truth for booking change rules.
 * Imported by both backend controllers and (if needed) server-side helpers.
 */

/** Hours before session start within which cancellation/reschedule is blocked. */
const CHANGE_CUTOFF_HOURS = 24;

/** Maximum number of times a player may reschedule a single booking. */
const MAX_RESCHEDULES = 1;

/**
 * Booking statuses that count as occupying a court slot.
 * 'cancelled' and 'rejected' do NOT block a slot so other players can book it.
 * Used in getVenueAvailability, createBooking conflict check, and rescheduleBooking conflict check.
 */
const SLOT_BLOCKING_STATUSES = ['pending', 'confirmed', 'completed'];

/**
 * Build the session start as a real Date using Malaysia time (UTC+8).
 * @param {{ date: string, startTime: string }} booking
 * @returns {Date}
 */
const getSessionStart = (booking) =>
  new Date(`${booking.date}T${booking.startTime}:00+08:00`);

/**
 * Build the session end as a real Date using Malaysia time (UTC+8).
 * @param {{ date: string, endTime: string }} booking
 * @returns {Date}
 */
const getSessionEnd = (booking) =>
  new Date(`${booking.date}T${booking.endTime}:00+08:00`);

/**
 * Determine whether a player may submit a review for a booking.
 * Returns true only when:
 *  - The booking belongs to the given player.
 *  - The booking has no existing review yet (pass hasReview=false if not yet checked).
 *  - status is 'completed', OR status is 'confirmed' and the session end time has passed.
 *  - NOT pending / cancelled / rejected / expired.
 *
 * @param {object}  booking    – plain object or Mongoose document
 * @param {string}  playerId   – the requesting player's _id as string
 * @param {boolean} hasReview  – true when a Review document already exists for this booking
 * @returns {boolean}
 */
const canReviewBooking = (booking, playerId, hasReview) => {
  // ownership
  if (booking.playerId.toString() !== playerId.toString()) return false;
  // already reviewed
  if (hasReview) return false;
  // status gate
  const reviewableStatuses = ['completed', 'confirmed'];
  if (!reviewableStatuses.includes(booking.status)) return false;
  // if still confirmed, session must have ended
  if (booking.status === 'confirmed') {
    const sessionEnd = getSessionEnd(booking);
    if (sessionEnd > new Date()) return false;
  }
  return true;
};

/**
 * Determine what self-service actions a player may perform on a booking.
 * @param {object} booking - Mongoose document or plain object
 * @returns {{ canCancel: boolean, canReschedule: boolean }}
 */
const getBookingPermissions = (booking) => {
  const statusOk = ['pending', 'confirmed'].includes(booking.status);
  if (!statusOk) return { canCancel: false, canReschedule: false };

  const sessionStart = getSessionStart(booking);
  const hoursUntil = (sessionStart - new Date()) / (1000 * 60 * 60);
  const withinWindow = hoursUntil > CHANGE_CUTOFF_HOURS;

  const canCancel = withinWindow;
  const canReschedule = withinWindow && (booking.rescheduleCount || 0) < MAX_RESCHEDULES;

  return { canCancel, canReschedule };
};

module.exports = {
  CHANGE_CUTOFF_HOURS,
  MAX_RESCHEDULES,
  SLOT_BLOCKING_STATUSES,
  getSessionStart,
  getSessionEnd,
  canReviewBooking,
  getBookingPermissions,
};
