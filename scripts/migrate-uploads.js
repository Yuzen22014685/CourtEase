// One-time deployment step: upload files referenced as '/uploads/...' in the LIVE database
// to Cloudinary and rewrite the references. The development database and uploads/ are not changed.
// Usage: node scripts/migrate-uploads.js [targetDb] [--apply]
//   default target: courtease_live; without --apply it is a DRY RUN (no uploads, no writes)
require('dotenv').config();
process.env.STORAGE_DRIVER = 'cloudinary';
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { saveFile, checkStorageConfig, detectImageType } = require('../utils/storage');

const args = process.argv.slice(2);
const targetName = args.find((a) => !a.startsWith('--')) || 'courtease_live';
const apply = args.includes('--apply');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const withDbName = (uri, name) => {
    const u = new URL(uri);
    u.pathname = `/${name}`;
    return u.toString();
};

// Every field that can hold an uploaded file, with its storage kind and file-name prefix.
const FIELDS = [
    { col: 'venues', field: 'photos', kind: 'venue-photo', array: true, prefix: (d) => d._id },
    { col: 'venues', field: 'layoutImage', kind: 'venue-layout', prefix: (d) => d._id },
    { col: 'venues', field: 'paymentInfo.duitNowQr', kind: 'venue-qr', prefix: (d) => d._id },
    { col: 'shopitems', field: 'photo', kind: 'shop-item', prefix: (d) => d.venueId || d._id },
    { col: 'platformsettings', field: 'paymentInfo.duitNowQr', kind: 'platform-qr', prefix: () => 'platform' },
    { col: 'bookings', field: 'receiptImage', kind: 'booking-receipt', prefix: (d) => d._id },
    { col: 'commissionstatements', field: 'receiptImage', kind: 'commission-receipt', prefix: (d) => d._id },
];

const getPath = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const isLocal = (v) => typeof v === 'string' && v.startsWith('/uploads/');

(async () => {
    const baseUri = process.env.MONGO_URI;
    if (!baseUri) throw new Error('MONGO_URI is not set');
    const devName = new URL(baseUri).pathname.replace(/^\//, '');
    if (!/^[A-Za-z0-9_-]+$/.test(targetName)) throw new Error('Invalid target database name');
    if (targetName === devName) throw new Error(`Refusing to migrate the development database "${devName}"`);
    checkStorageConfig();

    const conn = await mongoose.createConnection(withDbName(baseUri, targetName)).asPromise();
    console.log(`${apply ? 'APPLY' : 'DRY RUN (nothing will change)'} on database "${targetName}"\n`);

    const cache = new Map(); // `${kind}|${value}` -> new stored value
    const stats = { references: 0, files: 0, reused: 0, missing: 0, invalid: 0, docsUpdated: 0 };

    const convert = async (value, kind, prefix) => {
        stats.references++;
        const key = `${kind}|${value}`;
        if (cache.has(key)) { stats.reused++; return cache.get(key); }

        const file = path.join(UPLOAD_DIR, path.basename(value.split('?')[0]));
        if (!fs.existsSync(file)) { stats.missing++; console.log(`  MISSING  ${value}`); return null; }
        const buffer = await fs.promises.readFile(file);
        if (!detectImageType(buffer)) { stats.invalid++; console.log(`  INVALID  ${value} (not a real PNG/JPEG)`); return null; }

        if (!apply) { stats.files++; cache.set(key, `(would upload as ${kind})`); return cache.get(key); }
        try {
            const stored = await saveFile(buffer, kind, String(prefix));
            stats.files++;
            cache.set(key, stored);
            return stored;
        } catch (e) {
            stats.invalid++;
            console.log(`  FAILED   ${value}: ${e.message}`);
            return null;
        }
    };

    for (const f of FIELDS) {
        const coll = conn.db.collection(f.col);
        const docs = await coll.find({}).toArray();
        let refs = 0;
        let updated = 0;
        for (const d of docs) {
            const cur = getPath(d, f.field);
            if (f.array) {
                if (!Array.isArray(cur) || !cur.some(isLocal)) continue;
                const next = [];
                for (const v of cur) {
                    if (isLocal(v)) { refs++; next.push((await convert(v, f.kind, f.prefix(d))) || v); } else next.push(v);
                }
                if (apply && next.some((v, i) => v !== cur[i])) {
                    await coll.updateOne({ _id: d._id }, { $set: { [f.field]: next } });
                    updated++;
                }
            } else {
                if (!isLocal(cur)) continue;
                refs++;
                const nv = await convert(cur, f.kind, f.prefix(d));
                if (apply && nv) {
                    await coll.updateOne({ _id: d._id, [f.field]: cur }, { $set: { [f.field]: nv } });
                    updated++;
                }
            }
        }
        stats.docsUpdated += updated;
        console.log(`${(f.col + '.' + f.field).padEnd(38)} local refs: ${String(refs).padStart(3)}${apply ? `   documents updated: ${updated}` : ''}`);
    }

    // What is still local afterwards (should be 0 after --apply, apart from MISSING/INVALID)
    let left = 0;
    for (const f of FIELDS) {
        const docs = await conn.db.collection(f.col).find({}).toArray();
        for (const d of docs) {
            const cur = getPath(d, f.field);
            left += f.array ? (Array.isArray(cur) ? cur.filter(isLocal).length : 0) : (isLocal(cur) ? 1 : 0);
        }
    }

    await conn.close();
    console.log(`\nReferences found: ${stats.references} | ${apply ? 'files uploaded' : 'files to upload'}: ${stats.files} | shared (uploaded once): ${stats.reused} | missing: ${stats.missing} | invalid/failed: ${stats.invalid}`);
    console.log(`Local references remaining in "${targetName}": ${left}`);
})().catch((e) => {
    console.error('ERROR:', e.message || e);
    process.exit(1);
});