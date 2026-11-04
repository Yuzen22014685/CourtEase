// Remove everything created by scripts/seed-demo.js: the demo players (courtease.demo.NN@example.com)
// and their bookings, reviews and notifications. Real users and their data are never touched.
//
//   node scripts/cleanup-demo.js dev            -> dry run (counts only)
//   node scripts/cleanup-demo.js dev --apply    -> delete on the development database
//   node scripts/cleanup-demo.js live           -> dry run on the LIVE database
//   node scripts/cleanup-demo.js live --apply   -> delete on the LIVE database

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Notification = require('../models/Notification');

const LIVE_DB = 'courtease_live';
const DEMO_EMAIL_RE = /^courtease\.demo\.\d+@example\.com$/;

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
  throw new Error('Usage: node scripts/cleanup-demo.js dev|live [--apply]');
};

const main = async () => {
  const target = process.argv[2];
  const apply = process.argv.includes('--apply');
  const { uri, name } = resolveDb(target);

  await mongoose.connect(uri);
  if (mongoose.connection.name !== name) throw new Error(`Connected to "${mongoose.connection.name}", expected "${name}"`);
  console.log(`Database: ${name}${name === LIVE_DB ? '  (LIVE)' : ''}`);
  console.log(apply ? 'Mode: APPLY (deleting data)' : 'Mode: DRY RUN (nothing is deleted)');

  const players = await User.find({ email: DEMO_EMAIL_RE, role: 'player' }).select('_id email');
  const ids = players.map((p) => p._id);
  const filter = { playerId: { $in: ids } };
  const counts = {
    players: players.length,
    bookings: await Booking.countDocuments(filter),
    reviews: await Review.countDocuments(filter),
    notifications: await Notification.countDocuments(filter),
  };
  console.log(`Found: ${JSON.stringify(counts)}`);

  if (!apply) {
    console.log('DRY RUN only. Add --apply to delete.');
    return;
  }
  await Review.deleteMany(filter);
  await Notification.deleteMany(filter);
  await Booking.deleteMany(filter);
  await User.deleteMany({ _id: { $in: ids } });
  console.log('DONE: demo data removed. Commission statements generated while it existed are not changed.');
};

main()
  .catch((err) => { console.error(`\nERROR: ${err.message}`); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
