/**
 * scripts/remove-seeded-reviews.js
 *
 * One-time migration: removes all seeded (fake) review data.
 *
 * Run with:
 *   node scripts/remove-seeded-reviews.js
 *
 * What it does:
 *  1. Deletes every document in the Review collection (there should be none yet,
 *     but this is idempotent in case the script has been run before or test data exists).
 *  2. Unsets the `rating` and clears the embedded `reviews` array on every Venue document,
 *     so legacy seeded values are fully removed from the database.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Venue  = require('../models/Venue');
const Review = require('../models/Review');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Remove all Review documents
    const { deletedCount: reviewsDeleted } = await Review.deleteMany({});
    console.log(`🗑️  Deleted ${reviewsDeleted} Review document(s) from the Review collection.`);

    // 2. Clear seeded rating and embedded reviews array on all Venue documents
    const venueResult = await Venue.updateMany(
      {},
      {
        $unset:  { rating: '' },
        $set:    { reviews: [] },
      }
    );
    console.log(
      `🏟️  Cleared seeded rating/reviews on ${venueResult.modifiedCount} Venue document(s).`
    );

    console.log('\n✅ Done. All seeded reviews and ratings have been removed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

run();
