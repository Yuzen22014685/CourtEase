// utils/pricing.js — time-based (peak / off-peak) court pricing.
// Pure functions: no database access.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const round2 = (n) => Math.round(n * 100) / 100;

// Day of week for 'YYYY-MM-DD' (0 = Sunday ... 6 = Saturday).
// Parsed as UTC so the server's timezone can't shift the day.
const getDayOfWeek = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

// Rate for a day of week + minute of day. Rules never overlap, so the first match wins;
// otherwise the venue's default pricePerHour applies.
const getRateForDay = (venue, day, mins) => {
  const rule = (venue.pricingRules || []).find(
    (r) => r.days.includes(day) && toMinutes(r.start) <= mins && mins < toMinutes(r.end)
  );
  return rule ? rule.pricePerHour : venue.pricePerHour;
};

const getHourlyRate = (venue, dateStr, time) =>
  getRateForDay(venue, getDayOfWeek(dateStr), toMinutes(time));

// Court fee: each 60-minute segment is priced at the rate in force at its start time.
const computeCourtAmount = (venue, dateStr, startTime, endTime) => {
  const day = getDayOfWeek(dateStr);
  const end = toMinutes(endTime);
  let total = 0;
  for (let t = toMinutes(startTime); t < end; t += 60) {
    total += getRateForDay(venue, day, t) * ((Math.min(t + 60, end) - t) / 60);
  }
  return round2(total);
};

// Lowest / highest hourly rate in a normal week of opening hours (for "RM 15–24 / hr").
const getPriceRange = (venue) => {
  const open = toMinutes(venue.operatingHours.open);
  const close = toMinutes(venue.operatingHours.close);
  const rates = [];
  for (let day = 0; day <= 6; day++) {
    for (let t = open; t < close; t += 60) rates.push(getRateForDay(venue, day, t));
  }
  if (rates.length === 0) return { priceFrom: venue.pricePerHour, priceTo: venue.pricePerHour };
  return { priceFrom: Math.min(...rates), priceTo: Math.max(...rates) };
};

// Validates and normalises pricing rules. Returns { rules } or { error }.
const validatePricingRules = (input, operatingHours) => {
  if (input === undefined || input === null) return { rules: [] };
  if (!Array.isArray(input)) return { error: 'Pricing rules must be a list.' };
  if (input.length > 10) return { error: 'A venue can have at most 10 pricing rules.' };
  const open = toMinutes(operatingHours.open);
  const close = toMinutes(operatingHours.close);
  const rules = [];
  for (let i = 0; i < input.length; i++) {
    const r = input[i] || {};
    const n = i + 1;
    const days = Array.isArray(r.days)
      ? [...new Set(r.days.map(Number))].sort((a, b) => a - b)
      : [];
    if (days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      return { error: `Rule ${n}: choose at least one valid day.` };
    }
    if (!TIME_RE.test(r.start || '') || !TIME_RE.test(r.end || '')) {
      return { error: `Rule ${n}: times must be in HH:MM format.` };
    }
    const s = toMinutes(r.start);
    const e = toMinutes(r.end);
    if (s >= e) return { error: `Rule ${n}: start time must be before end time.` };
    if (s < open || e > close) {
      return { error: `Rule ${n}: times must be within opening hours (${operatingHours.open}–${operatingHours.close}).` };
    }
    const price = Number(r.pricePerHour);
    if (!Number.isFinite(price) || price < 0.01 || price > 1000) {
      return { error: `Rule ${n}: price per hour must be between RM 0.01 and RM 1000.` };
    }
    rules.push({ days, start: r.start, end: r.end, pricePerHour: round2(price) });
  }
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      const shareDay = a.days.some((d) => b.days.includes(d));
      if (shareDay && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)) {
        return { error: `Rules ${i + 1} and ${j + 1} overlap on the same day.` };
      }
    }
  }
  return { rules };
};

module.exports = { getDayOfWeek, getHourlyRate, computeCourtAmount, getPriceRange, validatePricingRules };
