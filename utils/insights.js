// utils/insights.js — monthly statistics for owner/admin Insights.
// Pure functions: no database access.
const { getDayOfWeek } = require('./pricing');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toMinutes = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
const round2 = (n) => Math.round(n * 100) / 100;
const round1 = (n) => Math.round(n * 10) / 10;

// Current month in Malaysia time, e.g. '2026-10'.
const currentMonthMY = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);

const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

// Booking dates are 'YYYY-MM-DD' strings, so a month is a simple string range.
const monthRange = (month) => {
  const [y, m] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    endExclusive: `${shiftMonth(month, 1)}-01`,
    daysInMonth: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
};

// Revenue = payments the venue has confirmed. A booking cancelled after confirmation
// still counts (no refunds: the venue keeps the money). Receipts not yet verified are
// reported separately as "awaiting verification", never as revenue.
const isVerifiedPaid = (b) =>
  b.status === 'confirmed' ||
  b.status === 'completed' ||
  (b.status === 'cancelled' && Boolean(b.confirmedAt));

// Sessions that actually use a court (utilisation, busiest days and hours).
const usesCourt = (b) => b.status === 'confirmed' || b.status === 'completed';

const computeMonthlyStats = (bookings, venues, month) => {
  const { daysInMonth } = monthRange(month);
  const counts = { confirmed: 0, pending: 0, cancelled: 0, rejected: 0, expired: 0 };
  let courtRevenue = 0;
  let shopRevenue = 0;
  let awaitingCount = 0;
  let awaitingAmount = 0;
  let bookedMinutes = 0;
  const byDay = new Array(7).fill(0);
  const byHour = new Array(24).fill(0);
  const items = new Map();

  for (const b of bookings) {
    if (usesCourt(b)) counts.confirmed += 1;
    else if (counts[b.status] !== undefined) counts[b.status] += 1;

    if (isVerifiedPaid(b)) {
      courtRevenue += b.amount || 0;
      shopRevenue += b.itemsTotal || 0;
      for (const it of b.items || []) {
        const key = String(it.itemId || it.name);
        const row = items.get(key) || { name: it.name, quantity: 0, revenue: 0 };
        row.quantity += it.quantity || 0;
        row.revenue += (it.unitPrice || 0) * (it.quantity || 0);
        items.set(key, row);
      }
    } else if (b.status === 'pending' && b.paymentStatus === 'paid') {
      awaitingCount += 1;
      awaitingAmount += (b.amount || 0) + (b.itemsTotal || 0);
    }

    if (usesCourt(b)) {
      const start = toMinutes(b.startTime);
      const end = toMinutes(b.endTime);
      bookedMinutes += Math.max(0, end - start);
      byDay[(getDayOfWeek(b.date) + 6) % 7] += 1;
      for (let t = start; t < end; t += 60) {
        const h = Math.floor(t / 60);
        if (h < 24) byHour[h] += 1;
      }
    }
  }

  let capacityMinutes = 0;
  for (const v of venues) {
    const open = toMinutes(v.operatingHours.open);
    const close = toMinutes(v.operatingHours.close);
    capacityMinutes += Math.max(0, close - open) * (v.numberOfCourts || 0) * daysInMonth;
  }
  const bookedHours = bookedMinutes / 60;
  const capacityHours = capacityMinutes / 60;

  return {
    month,
    revenue: {
      court: round2(courtRevenue),
      shop: round2(shopRevenue),
      total: round2(courtRevenue + shopRevenue),
    },
    awaitingVerification: { count: awaitingCount, amount: round2(awaitingAmount) },
    bookings: counts,
    utilisation: {
      bookedHours: round1(bookedHours),
      capacityHours: round1(capacityHours),
      pct: capacityHours > 0 ? round1((bookedHours / capacityHours) * 100) : 0,
    },
    busiestDays: DAY_LABELS.map((day, i) => ({ day, bookings: byDay[i] })),
    peakHours: byHour.map((n, h) => ({ hour: h, label: `${String(h).padStart(2, '0')}:00`, bookings: n })),
    topItems: [...items.values()]
      .map((r) => ({ ...r, revenue: round2(r.revenue) }))
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5),
  };
};

// Percentage change; null when there is nothing to compare against.
const percentChange = (current, previous) =>
  previous > 0 ? round1(((current - previous) / previous) * 100) : null;

module.exports = {
  MONTH_RE, currentMonthMY, shiftMonth, monthRange, isVerifiedPaid, computeMonthlyStats, percentChange,
};
