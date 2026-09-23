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
  getBookingPermissions,
};
