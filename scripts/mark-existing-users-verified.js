require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI not found in environment.');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Update every existing user that does not have isEmailVerified: true yet
    const result = await User.updateMany(
      { isEmailVerified: { $ne: true } },
      { $set: { isEmailVerified: true } }
    );

    console.log(`🎉 Successfully updated ${result.modifiedCount} existing user(s) to isEmailVerified: true.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating users:', err);
    process.exit(1);
  }
};

run();
