// scripts/check-slot-index.js
// Checks MongoDB version, finds existing duplicate active slots, and confirms the uniq_active_slot index exists.
// Usage: node scripts/check-slot-index.js            (report only)
//        node scripts/check-slot-index.js --create   (build missing indexes; only if there are 0 duplicates)
require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const info = await mongoose.connection.db.admin().serverInfo();
  console.log('MongoDB server version:', info.version, '(needs 6.0+ for $in in a partial index)');

  const dups = await Booking.aggregate([
    { $match: { status: { $in: ['pending', 'confirmed', 'completed'] } } },
    { $group: { _id: { courtId: '$courtId', date: '$date', startTime: '$startTime' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  console.log('Duplicate active slots found:', dups.length);
  if (dups.length) console.log(JSON.stringify(dups, null, 2));

  if (process.argv.includes('--create')) {
    if (dups.length) {
      console.log('NOT creating index: resolve duplicates first.');
    } else {
      await Booking.createIndexes();
      console.log('createIndexes() done.');
    }
  }
  const idx = await Booking.collection.indexes();
  console.log('uniq_active_slot present:', idx.some((i) => i.name === 'uniq_active_slot'));
  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });

