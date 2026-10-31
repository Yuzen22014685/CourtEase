// Provision an admin account out-of-band (admins are never created through the web UI).
// Usage:
//   node scripts/create-admin.js --db <courtease|courtease_live> "Full Name" admin@example.com [--send-email]
// The new admin gets NO known password: the script prints a one-time setup link (valid 24 h)
// and, with --send-email, also emails it. The admin chooses their own password on that page,
// so nobody else (not even the person running the script) ever knows it.
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');

const LIVE_DB = 'courtease_live';
const LIVE_CLIENT_URL = process.env.LIVE_CLIENT_URL || 'https://courtease-booking.vercel.app';
const SETUP_LINK_HOURS = 24;

const args = process.argv.slice(2);
const dbIdx = args.indexOf('--db');
const dbName = dbIdx >= 0 ? args[dbIdx + 1] : null;
const positional = args.filter((a, i) => !a.startsWith('--') && (dbIdx < 0 || i !== dbIdx + 1));
const [fullName, rawEmail] = positional;
const sendEmail = args.includes('--send-email');

const usage = () => {
    console.log('Usage: node scripts/create-admin.js --db <courtease|courtease_live> "Full Name" admin@example.com [--send-email]');
    process.exit(1);
};

(async () => {
    if (!dbName || !/^[A-Za-z0-9_-]+$/.test(dbName) || !fullName || !rawEmail) usage();
    const email = String(rawEmail).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Invalid email: ${rawEmail}`);
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');

    // Links must point at the site that uses this database
    const clientUrl = dbName === LIVE_DB ? LIVE_CLIENT_URL : (process.env.CLIENT_URL || 'http://localhost:5173');
    process.env.CLIENT_URL = clientUrl;

    const User = require('../models/User');
    const { sendPasswordResetEmail } = require('../utils/emailService');

    const u = new URL(process.env.MONGO_URI);
    u.pathname = `/${dbName}`;
    await mongoose.connect(u.toString());
    if (mongoose.connection.name !== dbName) throw new Error(`Connected to "${mongoose.connection.name}", expected "${dbName}"`);
    console.log(`Database: ${dbName}${dbName === LIVE_DB ? '  (LIVE)' : ''}`);

    const existing = await User.findOne({ email }).select('role').lean();
    if (existing) throw new Error(`An account with ${email} already exists (role: ${existing.role}). Nothing changed.`);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const user = await User.create({
        fullName: String(fullName).trim(),
        email,
        password: crypto.randomBytes(32).toString('hex'), // random and never shown: unusable until the admin sets their own
        role: 'admin',
        isEmailVerified: true,
        passwordResetTokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
        passwordResetExpires: new Date(now + SETUP_LINK_HOURS * 60 * 60 * 1000),
        passwordResetSentAt: new Date(now),
    });

    const link = `${clientUrl}/reset-password/${rawToken}?invite=1`;
    console.log(`\nCREATED  admin  ${user.email}  (${user.fullName})`);
    console.log(`Setup link (valid ${SETUP_LINK_HOURS} h, single use):\n${link}\n`);

    if (sendEmail) {
        try {
            await sendPasswordResetEmail(user, rawToken);
            console.log(`Setup email sent to ${email}.`);
        } catch (e) {
            console.log(`Email failed (${e.message}). Give the link above to the new admin through a private channel.`);
        }
    } else {
        console.log('No email sent (add --send-email to email it). Share the link only with the new admin.');
    }

    await mongoose.disconnect();
})().catch(async (e) => {
    console.error('ERROR:', e.message || e);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
});