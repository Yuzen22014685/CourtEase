// scripts/race-test.js
// Concurrency test for CourtEase booking creation.
// Fires N simultaneous booking requests at the SAME court/date/slot (N = 2..11, 10 trials),
// then counts how many slot-holding bookings were stored. Test bookings are deleted after each trial.
// Usage: node scripts/race-test.js pre    (before fix)
//        node scripts/race-test.js post   (after fix)
require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');

// ===== Test configuration =====
const API = process.env.RACE_API || 'http://localhost:5000/api';    // ADAPT port/prefix if different
const LOGIN_PATH = '/auth/login';                                    // ADAPT to the real login route
const BOOK_PATH = '/bookings';                                       // POST route for createBooking
const PLAYER = { email: process.env.RACE_EMAIL, password: process.env.RACE_PASSWORD };
const VENUE_ID = process.env.RACE_VENUE_ID;
const COURT_ID = process.env.RACE_COURT_ID;
const DATE = process.env.RACE_DATE;        // a future date inside the booking window, venue open
const START = process.env.RACE_START || '10:00';
const END = process.env.RACE_END || '11:00';
const ACTIVE = ['pending', 'confirmed', 'completed'];
// ==============================

const label = process.argv[2] || 'run';

async function login() {
  const res = await fetch(API + LOGIN_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(PLAYER),
  });
  if (!res.ok) throw new Error(`Login failed: HTTP ${res.status}`);
  const data = await res.json();
  const token = data.token || (data.data && data.data.token);       // ADAPT to the real response shape
  const cookie = res.headers.get('set-cookie');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(cookie ? { Cookie: cookie.split(';')[0] } : {}),
  };
}

function payload(trial, i) {
  // ADAPT: match the fields createBooking expects (keep the same court/date/slot for every request)
  return {
    venueId: VENUE_ID,
    courtId: COURT_ID,
    date: DATE,
    startTime: START,
    endTime: END,
    paymentMethod: 'duitnow_qr',
  };
}

const slotQuery = { courtId: COURT_ID, date: DATE, startTime: START };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await Booking.countDocuments({ ...slotQuery, status: { $in: ACTIVE } });
  if (existing > 0) {
    console.error(`Abort: slot already has ${existing} active booking(s). Pick another RACE_DATE/RACE_START.`);
    process.exit(1);
  }
  const headers = await login();
  const rows = [];

  for (let n = 2; n <= 11; n++) {
    const trialStart = new Date();
    const statuses = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        fetch(API + BOOK_PATH, { method: 'POST', headers, body: JSON.stringify(payload(n - 1, i)) })
          .then((r) => r.status)
          .catch(() => 'ERR')
      )
    );
    const accepted = statuses.filter((s) => s === 200 || s === 201).length;
    const rejected409 = statuses.filter((s) => s === 409).length;
    const stored = await Booking.countDocuments({ ...slotQuery, status: { $in: ACTIVE } });
    rows.push({
      trial: n - 1,
      simultaneousUsers: n,
      accepted,
      rejected409,
      otherStatus: n - accepted - rejected409,
      storedInDB: stored,
      doubleBooked: stored > 1 ? 'YES' : 'no',
    });
    await Booking.deleteMany({ ...slotQuery, createdAt: { $gte: trialStart } });
  }

  console.log(`\n=== Concurrency test (${label.toUpperCase()}) — court ${COURT_ID}, ${DATE} ${START}-${END} ===`);
  console.table(rows);
  const dbl = rows.filter((r) => r.doubleBooked === 'YES').length;
  console.log(`Trials with double booking: ${dbl}/10`);
  fs.mkdirSync('scratch', { recursive: true });
  fs.writeFileSync(`scratch/race-results-${label}.json`, JSON.stringify(rows, null, 2));
  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });

