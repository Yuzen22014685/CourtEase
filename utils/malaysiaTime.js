// Malaysia time (UTC+8, no daylight saving) helpers.
// Dates are "YYYY-MM-DD" strings and times are "HH:MM" strings, the same format as Booking.
// Never use new Date().toISOString().slice(0, 10) for "today": that is the UTC date,
// which is still yesterday between 00:00 and 08:00 in Malaysia.

const MY_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Today's date in Malaysia, e.g. "2026-11-02"
const todayMY = (now = new Date()) =>
    new Date(now.getTime() + MY_OFFSET_MS).toISOString().slice(0, 10);

// Real calendar date only ("2026-02-30" is rejected)
const isValidDateString = (s) => {
    if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const isValidTimeString = (s) => typeof s === 'string' && TIME_RE.test(s);

// "HH:MM" -> minutes since midnight (null if invalid)
const timeToMinutes = (s) => {
    if (!isValidTimeString(s)) return null;
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
};

// "2026-11-02" + 365 -> "2027-11-02"
const addDaysToDateString = (s, days) => {
    const d = new Date(`${s}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

// Malaysia date + time -> real instant (Date)
const toMYDate = (date, time) => new Date(`${date}T${time}:00+08:00`);

module.exports = {
    todayMY,
    isValidDateString,
    isValidTimeString,
    timeToMinutes,
    addDaysToDateString,
    toMYDate,
};