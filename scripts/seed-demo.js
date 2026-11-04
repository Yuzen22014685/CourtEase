// Seed realistic DEMO bookings (plus demo players and reviews) for screenshots.
//
//   node scripts/seed-demo.js dev            -> dry run on the development database (changes nothing)
//   node scripts/seed-demo.js dev --apply    -> write to the development database
//   node scripts/seed-demo.js live           -> dry run on the LIVE database (changes nothing)
//   node scripts/seed-demo.js live --apply   -> write to the LIVE database
//
// Safety:
// - Demo players use the reserved domain example.com (mail to it is never delivered) and are the
//   only owners of the demo data, so scripts/cleanup-demo.js can remove everything again.
// - Direct inserts trigger no emails or notifications (no Mongoose hooks). The cron jobs are kept
//   quiet: past sessions are inserted already 'completed' or final, no 'pending' bookings are created,
//   and every upcoming 'confirmed' session gets its 'reminder' notification up front, so the
//   reminder job never emails a demo player.
// - Slots are taken from the same availability matrix the site uses, so real bookings are never
//   double-booked. Issued commission statements are frozen and are not touched.

require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Venue = require('../models/Venue');
const Court = require('../models/Court');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Notification = require('../models/Notification');

let ShopItem = null;
try { ShopItem = require('../models/ShopItem'); } catch { ShopItem = null; }

let buildAvailabilityMatrix = null;
try { ({ buildAvailabilityMatrix } = require('../utils/availability')); } catch { buildAvailabilityMatrix = null; }

const LIVE_DB = 'courtease_live';
const DEMO_EMAIL_RE = /^courtease\.demo\.\d+@example\.com$/;
const PAST_DAYS = 29;   // yesterday back to 29 days ago
const FUTURE_DAYS = 10; // tomorrow up to 10 days ahead (plus later today)

const DEMO_PLAYERS = [
  ['Tan Wei Jie', 'Male', 'Pro'],
  ['Nurul Aina', 'Female', 'Beginner'],
  ['Lim Jia Hui', 'Female', 'Beginner'],
  ['Muhammad Haziq', 'Male', 'Athlete'],
  ['Chong Kai Xiang', 'Male', 'Pro'],
  ['Siti Aisyah', 'Female', 'Beginner'],
  ['Arjun Nair', 'Male', 'Pro'],
  ['Ng Mei Ling', 'Female', 'Pro'],
  ['Ahmad Danial', 'Male', 'Beginner'],
  ['Wong Zi Xuan', 'Female', 'Athlete'],
];

const REVIEW_COMMENTS = {
  5: ['Great courts and good lighting, will book again.', 'Clean hall and friendly staff.', 'Easy to book and the court was ready on time.', 'Best place for evening games with friends.'],
  4: ['Good courts, parking is a bit limited at night.', 'Nice place, the air flow could be better.', 'Good value for the price.', 'Courts were fine, check-in was quick.'],
  3: ['Okay overall, a bit warm in the evening.', 'Courts are fine but the toilets need cleaning.'],
  2: ['Lighting on one court was weak.'],
};

// ── Small helpers ────────────────────────────────────────────────────────────
let seed = 20261104;
const rand = () => { // mulberry32: repeatable results for the same day
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const MY_OFFSET_MS = 8 * 60 * 60 * 1000;
const todayMY = () => new Date(Date.now() + MY_OFFSET_MS).toISOString().slice(0, 10);
const addDays = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const isWeekend = (d) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const at = (date, time) => new Date(`${date}T${time}:00+08:00`);
const hours = (h) => h * 60 * 60 * 1000;
const minDate = (a, b) => (a < b ? a : b);
const paymentRef = () => `CE-${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;

// Same structure as utils/availability.js; only used if that module cannot be loaded.
const fallbackMatrix = async (venue, date) => {
  const courts = await Court.find({ venueId: venue._id, status: 'active' }).sort('courtNumber');
  const taken = await Booking.find({ venueId: venue._id, date, status: { $in: ['pending', 'confirmed', 'completed'] } });
  const open = toMin(venue.operatingHours.open);
  const close = toMin(venue.operatingHours.close);
  return courts.map((c) => {
    const slots = [];
    for (let m = open; m + 60 <= close; m += 60) {
      const booked = taken.some((b) => String(b.courtId) === String(c._id) && toMin(b.startTime) <= m && toMin(b.endTime) > m);
      slots.push({ start: fromMin(m), end: fromMin(m + 60), available: !booked, price: venue.pricePerHour });
    }
    return { courtId: c._id, courtNumber: c.courtNumber, status: c.status, slots };
  });
};

const resolveDb = (target) => {
  const base = process.env.MONGO_URI;
  if (!base) throw new Error('MONGO_URI is not set in .env');
  const u = new URL(base);
  const devName = u.pathname.replace(/^\//, '');
  if (target === 'dev') {
    if (!devName) throw new Error('MONGO_URI has no database name');
    if (devName === LIVE_DB) throw new Error(`MONGO_URI points at ${LIVE_DB}; use "live" explicitly`);
    return { uri: base, name: devName };
  }
  if (target === 'live') { u.pathname = `/${LIVE_DB}`; return { uri: u.toString(), name: LIVE_DB }; }
  throw new Error('Usage: node scripts/seed-demo.js dev|live [--apply]');
};

// ── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  const target = process.argv[2];
  const apply = process.argv.includes('--apply');
  const { uri, name } = resolveDb(target);

  await mongoose.connect(uri);
  if (mongoose.connection.name !== name) throw new Error(`Connected to "${mongoose.connection.name}", expected "${name}"`);
  console.log(`Database: ${name}${name === LIVE_DB ? '  (LIVE)' : ''}`);
  console.log(apply ? 'Mode: APPLY (writing data)' : 'Mode: DRY RUN (nothing is written)');
  console.log(`Availability: ${buildAvailabilityMatrix ? 'utils/availability.js' : 'built-in fallback (venue base price)'}`);
  console.log(`Add-ons: ${ShopItem ? 'enabled' : 'skipped (models/ShopItem not found)'}`);

  const existing = await User.countDocuments({ email: DEMO_EMAIL_RE });
  if (existing > 0) throw new Error(`${existing} demo players already exist. Run scripts/cleanup-demo.js first.`);

  const venues = await Venue.find({ isActive: { $ne: false } });
  if (venues.length === 0) throw new Error('No active venues found');

  // Demo players (ids fixed now so bookings can reference them)
  const players = DEMO_PLAYERS.map(([fullName, gender, skillLevel], i) => ({
    _id: new mongoose.Types.ObjectId(),
    fullName, gender, skillLevel,
    email: `courtease.demo.${String(i + 1).padStart(2, '0')}@example.com`,
  }));

  const now = new Date();
  const today = todayMY();
  const dates = [];
  for (let d = PAST_DAYS; d >= 1; d--) dates.push({ date: addDays(today, -d), when: 'past' });
  dates.push({ date: today, when: 'today' });
  for (let d = 1; d <= FUTURE_DAYS; d++) dates.push({ date: addDays(today, d), when: 'future' });

  const bookings = [];
  const reviews = [];
  const notifications = [];
  const perVenue = new Map();

  for (const venue of venues) {
    const qr = Boolean(venue.paymentInfo?.duitNowQr?.trim());
    const bank = Boolean(venue.paymentInfo?.bankName?.trim() && venue.paymentInfo?.accountName?.trim() && venue.paymentInfo?.accountNumber?.trim());
    const methods = qr && bank ? ['duitnow_qr', 'duitnow_qr', 'bank_transfer'] : qr ? ['duitnow_qr'] : ['bank_transfer'];
    const shopItems = ShopItem ? await ShopItem.find({ venueId: venue._id, isAvailable: true }) : [];
    let venueCount = 0;

    for (const { date, when } of dates) {
      const matrix = buildAvailabilityMatrix ? await buildAvailabilityMatrix(venue, date) : await fallbackMatrix(venue, date);
      const courts = matrix.filter((c) => c.status === 'active');
      if (courts.length === 0) continue;
      const used = new Set();
      const free = (court, slot) => slot.available && !used.has(`${court.courtId}|${slot.start}`);

      let target = when === 'past' ? (isWeekend(date) ? randInt(6, 10) : randInt(3, 7)) : randInt(1, 3);
      let guard = 0;
      while (target > 0 && guard++ < 200) {
        const court = pick(courts);
        // Evenings are busier: weight slots from 17:00 three times
        const weighted = court.slots.flatMap((s, i) => (toMin(s.start) >= 17 * 60 ? [i, i, i] : [i]));
        const i = pick(weighted);
        const first = court.slots[i];
        if (!first || !free(court, first)) continue;
        if (when === 'today' && at(date, first.start) < new Date(now.getTime() + hours(2))) continue;
        const second = court.slots[i + 1];
        const len = second && free(court, second) && rand() < 0.3 && target > 1 ? 2 : 1;
        const slots = len === 2 ? [first, second] : [first];

        const player = pick(players);
        const ref = paymentRef();
        const method = pick(methods);
        const start = at(date, first.start);
        const end = at(date, slots[slots.length - 1].end);
        const createdAt = when === 'past'
          ? new Date(start.getTime() - hours(randInt(2, 72)))
          : new Date(now.getTime() - hours(randInt(1, 48)));
        const confirmedAt = minDate(new Date(createdAt.getTime() + hours(randInt(1, 6))), now);

        let status = 'confirmed';
        let extra = {};
        if (when === 'past') {
          const r = rand();
          if (r < 0.85) status = 'completed';
          else if (r < 0.94) status = 'cancelled';
          else { status = 'rejected'; extra = { paymentStatus: 'not_verified', rejectionReason: 'Receipt amount did not match the booking total.' }; }
        }

        let items = [];
        let itemsTotal = 0;
        if (shopItems.length > 0 && rand() < 0.25) {
          const it = pick(shopItems);
          const quantity = randInt(1, 2);
          items = [{ itemId: it._id, name: it.name, category: it.category, unitPrice: it.price, quantity, note: '', readyInfo: it.readyInfo || '' }];
          itemsTotal = Math.round(it.price * quantity * 100) / 100;
        }

        slots.forEach((s, k) => {
          used.add(`${court.courtId}|${s.start}`);
          const doc = {
            _id: new mongoose.Types.ObjectId(),
            playerId: player._id,
            venueId: venue._id,
            courtId: court.courtId,
            date,
            startTime: s.start,
            endTime: s.end,
            status,
            paymentStatus: 'paid',
            paymentMethod: method,
            amount: typeof s.price === 'number' ? s.price : venue.pricePerHour,
            paymentRef: ref,
            confirmedAt: status === 'rejected' ? null : confirmedAt,
            receiptReminderSent: true,
            summaryEmailSentAt: k === 0 ? createdAt : null,
            items: k === 0 ? items : [],
            itemsTotal: k === 0 ? itemsTotal : 0,
            ...extra,
            _createdAt: createdAt,
          };
          bookings.push(doc);
          if (when !== 'past') {
            notifications.push({ playerId: player._id, bookingId: doc._id, type: 'reminder', message: `Reminder: your court session at ${venue.name} starts at ${s.start}.`, isRead: true, sentAt: now });
          }
        });

        if (status === 'completed' && rand() < 0.18) {
          const r = rand();
          const rating = r < 0.5 ? 5 : r < 0.85 ? 4 : r < 0.97 ? 3 : 2;
          reviews.push({
            venueId: venue._id,
            bookingId: bookings[bookings.length - slots.length]._id,
            playerId: player._id,
            rating,
            comment: pick(REVIEW_COMMENTS[rating]),
            createdAt: minDate(new Date(end.getTime() + hours(randInt(2, 30))), now),
          });
        }

        venueCount += len;
        target -= len;
      }
    }
    perVenue.set(venue.name, venueCount);
  }

  // ── Report ──
  const byStatus = bookings.reduce((m, b) => ({ ...m, [b.status]: (m[b.status] || 0) + 1 }), {});
  console.log(`\nDates: ${dates[0].date} to ${dates[dates.length - 1].date} (today ${today})`);
  console.log(`Demo players: ${players.length} (courtease.demo.01..${String(players.length).padStart(2, '0')}@example.com)`);
  for (const [v, n] of perVenue) console.log(`  ${v}: ${n} sessions`);
  console.log(`Sessions: ${bookings.length}  by status: ${JSON.stringify(byStatus)}`);
  console.log(`Reviews: ${reviews.length}   Reminder notifications (block reminder emails): ${notifications.length}`);
  console.log(`Court revenue (completed + confirmed): RM ${bookings.filter((b) => ['completed', 'confirmed'].includes(b.status)).reduce((s, b) => s + b.amount, 0).toFixed(2)}`);

  if (!apply) {
    console.log('\nDRY RUN only. Add --apply to write this data.');
    return;
  }

  // ── Write ──
  for (const p of players) {
    await User.create({
      _id: p._id, fullName: p.fullName, gender: p.gender, skillLevel: p.skillLevel, email: p.email,
      password: crypto.randomBytes(24).toString('hex'), // never used: demo players do not log in
      role: 'player', isEmailVerified: true,
    });
  }
  await Booking.insertMany(bookings.map(({ _createdAt, ...b }) => b));
  await Booking.collection.bulkWrite(bookings.map((b) => ({
    updateOne: { filter: { _id: b._id }, update: { $set: { createdAt: b._createdAt, updatedAt: b._createdAt } } },
  })));
  if (reviews.length) await Review.insertMany(reviews);
  if (notifications.length) await Notification.insertMany(notifications);

  console.log(`\nDONE: wrote ${players.length} players, ${bookings.length} bookings, ${reviews.length} reviews, ${notifications.length} notifications.`);
};

main()
  .catch((err) => { console.error(`\nERROR: ${err.message}`); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
