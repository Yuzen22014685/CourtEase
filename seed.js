require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Venue = require('./models/Venue');
const Court = require('./models/Court');
const Booking = require('./models/Booking');
const Notification = require('./models/Notification');
const Review = require('./models/Review');

// ---------------------------------------------------------------------------
// Venue seed data — 5 Penang locations
// ---------------------------------------------------------------------------
const VENUES = [
  {
    name: 'Bayan Lepas Sports Arena',
    area: 'Bayan Lepas',
    address: 'No. 12, Jalan Lapangan Terbang Lama, Bayan Lepas, 11900 Penang',
    operatingHours: { open: '07:00', close: '23:00' },
    numberOfCourts: 6,
    pricePerHour: 25,
    photos: [
      'https://images.unsplash.com/photo-1743601587751-01dc32b707d2?fm=jpg&q=60&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1567220734778-52aeef6a84e8?fm=jpg&q=60&w=800&auto=format&fit=crop'
    ],
    facilities: ['Parking', 'Shower', 'Toilet', 'Water Dispenser', 'Pro Shop'],
  },
  {
    name: 'Georgetown Badminton Club',
    area: 'Georgetown',
    address: 'No. 45, Jalan Penang, Georgetown, 10000 Penang',
    operatingHours: { open: '08:00', close: '22:00' },
    numberOfCourts: 8,
    pricePerHour: 30,
    photos: [
      'https://images.unsplash.com/photo-1743601587751-01dc32b707d2?fm=jpg&q=60&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1567220734778-52aeef6a84e8?fm=jpg&q=60&w=800&auto=format&fit=crop'
    ],
    facilities: ['Air Conditioning', 'Shower', 'Toilet', 'Lockers', 'Cafe'],
  },
  {
    name: 'Bukit Mertajam Court Hub',
    area: 'Bukit Mertajam',
    address: 'Lot 7, Jalan Perda Timur, Bukit Mertajam, 14000 Penang',
    operatingHours: { open: '07:00', close: '22:00' },
    numberOfCourts: 5,
    pricePerHour: 20,
    photos: [
      'https://images.unsplash.com/photo-1743601587751-01dc32b707d2?fm=jpg&q=60&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1567220734778-52aeef6a84e8?fm=jpg&q=60&w=800&auto=format&fit=crop'
    ],
    facilities: ['Parking', 'Toilet', 'Water Dispenser'],
  },
  {
    name: 'Tanjung Bungah Seaside Courts',
    area: 'Tanjung Bungah',
    address: 'No. 3, Jalan Tanjung Bungah, 11200 Penang',
    operatingHours: { open: '08:00', close: '22:00' },
    numberOfCourts: 4,
    pricePerHour: 35,
    photos: [
      'https://images.unsplash.com/photo-1743601587751-01dc32b707d2?fm=jpg&q=60&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1567220734778-52aeef6a84e8?fm=jpg&q=60&w=800&auto=format&fit=crop'
    ],
    facilities: ['Outdoor Seating', 'Shower', 'Toilet', 'Parking', 'Vending Machine'],
  },
  {
    name: 'Jelutong Badminton Hall',
    area: 'Jelutong',
    address: 'Jalan Jelutong, Jelutong, 11700 Penang',
    operatingHours: { open: '07:00', close: '23:00' },
    numberOfCourts: 7,
    pricePerHour: 22,
    photos: [
      'https://images.unsplash.com/photo-1743601587751-01dc32b707d2?fm=jpg&q=60&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1567220734778-52aeef6a84e8?fm=jpg&q=60&w=800&auto=format&fit=crop'
    ],
    facilities: ['Parking', 'Toilet', 'Prayer Room', 'Water Dispenser'],
  }
];

// ---------------------------------------------------------------------------
// Helper: pick random element
// ---------------------------------------------------------------------------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------
// Helper: format date to YYYY-MM-DD (local)
// ---------------------------------------------------------------------------
const formatDate = (d) => d.toISOString().split('T')[0];

// ---------------------------------------------------------------------------
// Helper: generate a random start hour between open and (close - 1)
// ---------------------------------------------------------------------------
const randomStartHour = (open, close) => {
  const openH = parseInt(open.split(':')[0]);
  const closeH = parseInt(close.split(':')[0]);
  return openH + Math.floor(Math.random() * (closeH - openH - 1));
};

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Venue.deleteMany({}),
      Court.deleteMany({}),
      Booking.deleteMany({}),
      Notification.deleteMany({}),
      Review.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // Create admin user
    const adminUser = await User.create({
      fullName: 'Admin CourtEase',
      gender: 'Male',
      email: 'admin@courtease.my',
      password: 'Admin@1234',
      role: 'admin',
      phone: '0112345678',
      address: 'CourtEase HQ, Penang',
      skillLevel: 'Pro',
      isEmailVerified: true,
    });
    console.log('👤 Admin created:', adminUser.email);

    // Create 10 player users
    const playerData = [
      { fullName: 'Ahmad Faris', gender: 'Male', skillLevel: 'Beginner' },
      { fullName: 'Nurul Ain', gender: 'Female', skillLevel: 'Pro' },
      { fullName: 'Ravi Kumar', gender: 'Male', skillLevel: 'Athlete' },
      { fullName: 'Siti Nabilah', gender: 'Female', skillLevel: 'Beginner' },
      { fullName: 'Lim Wei Jie', gender: 'Male', skillLevel: 'Pro' },
      { fullName: 'Priya Sath', gender: 'Female', skillLevel: 'Beginner' },
      { fullName: 'Hairul Nizam', gender: 'Male', skillLevel: 'Athlete' },
      { fullName: 'Chua Mei Ling', gender: 'Female', skillLevel: 'Pro' },
      { fullName: 'Azri Azhar', gender: 'Male', skillLevel: 'Beginner' },
      { fullName: 'Kavitha Raj', gender: 'Female', skillLevel: 'Pro' },
    ];

    const players = await Promise.all(
      playerData.map((p, i) =>
        User.create({
          ...p,
          email: `player${i + 1}@courtease.my`,
          password: 'Player@1234',
          phone: `011${String(10000000 + i).padStart(8, '0')}`,
          address: `${i + 1} Jalan Residensi, Penang`,
          isEmailVerified: true,
        })
      )
    );
    console.log(`👥 ${players.length} players created`);

    // Create venues
    const venues = await Venue.insertMany(VENUES);
    console.log(`🏟️  ${venues.length} venues created`);

    // Create courts for each venue
    const allCourts = [];
    for (const venue of venues) {
      for (let n = 1; n <= venue.numberOfCourts; n++) {
        allCourts.push({ venueId: venue._id, courtNumber: n, status: 'active' });
      }
    }
    const courts = await Court.insertMany(allCourts);
    console.log(`🏸 ${courts.length} courts created`);

    // Seed ~30 past bookings over the last 14 days
    const paymentMethods = ['card', 'fpx', 'ewallet'];
    const statuses = ['completed', 'completed', 'completed', 'cancelled']; // weight toward completed
    const createdBookings = [];
    const usedSlots = new Set(); // prevent double-booking same court+date+time

    let attempts = 0;
    while (createdBookings.length < 30 && attempts < 300) {
      attempts++;

      const venue = pick(venues);
      const venueCourts = courts.filter((c) => c.venueId.toString() === venue._id.toString());
      const court = pick(venueCourts);
      const player = pick(players);

      const daysAgo = Math.floor(Math.random() * 14);
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const date = formatDate(d);

      const startHour = randomStartHour(venue.operatingHours.open, venue.operatingHours.close);
      const duration = pick([1, 1, 1, 2]); // mostly 1-hour sessions
      const endHour = startHour + duration;
      const closeHour = parseInt(venue.operatingHours.close.split(':')[0]);

      if (endHour > closeHour) continue;

      const startTime = `${String(startHour).padStart(2, '0')}:00`;
      const endTime = `${String(endHour).padStart(2, '0')}:00`;

      const slotKey = `${court._id}-${date}-${startTime}`;
      if (usedSlots.has(slotKey)) continue;
      usedSlots.add(slotKey);

      const status = pick(statuses);
      const paymentStatus = 'paid';
      const amount = venue.pricePerHour * duration;

      const booking = await Booking.create({
        playerId: player._id,
        venueId: venue._id,
        courtId: court._id,
        date,
        startTime,
        endTime,
        status,
        paymentStatus,
        paymentMethod: pick(paymentMethods),
        amount,
        receiptId: `RCP-SEED-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        createdAt: d,
      });
      createdBookings.push(booking);
    }
    console.log(`📅 ${createdBookings.length} bookings seeded`);

    console.log('\n✅ Seed complete!');
    console.log('──────────────────────────────────────────');
    console.log('Admin login:   admin@courtease.my / Admin@1234');
    console.log('Player login:  player1@courtease.my / Player@1234');
    console.log('──────────────────────────────────────────');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
};

seed();
