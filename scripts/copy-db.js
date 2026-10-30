// Copies the development database into a separate database for the live site.
// Usage: node scripts/copy-db.js [targetDbName] [--drop-target]
//   default target: courtease_live
// Reads MONGO_URI from .env. The SOURCE database is only read, never modified.
require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const targetName = args.find((a) => !a.startsWith('--')) || 'courtease_live';
const dropTarget = args.includes('--drop-target');

const withDbName = (uri, name) => {
    const u = new URL(uri);
    u.pathname = `/${name}`;
    return u.toString();
};

(async () => {
    const srcUri = process.env.MONGO_URI;
    if (!srcUri) throw new Error('MONGO_URI is not set');
    const srcName = new URL(srcUri).pathname.replace(/^\//, '');
    if (!srcName) throw new Error('MONGO_URI has no database name');
    if (!/^[A-Za-z0-9_-]+$/.test(targetName)) throw new Error('Invalid target database name');
    if (srcName === targetName) throw new Error('Target must be different from the source database');

    const src = await mongoose.createConnection(srcUri).asPromise();
    const dst = await mongoose.createConnection(withDbName(srcUri, targetName)).asPromise();
    console.log(`Source: ${srcName}  ->  Target: ${targetName}\n`);

    const existing = (await dst.db.listCollections().toArray()).filter((c) => !c.name.startsWith('system.'));
    if (existing.length && !dropTarget) {
        throw new Error(`Target "${targetName}" already has ${existing.length} collection(s). Re-run with --drop-target to replace it.`);
    }
    if (existing.length && dropTarget) {
        await dst.db.dropDatabase();
        console.log(`Dropped existing "${targetName}".\n`);
    }

    const collections = (await src.db.listCollections({ type: 'collection' }).toArray())
        .filter((c) => !c.name.startsWith('system.'));

    let allMatch = true;
    for (const { name } of collections) {
        const docs = await src.db.collection(name).find({}).toArray();
        const target = dst.db.collection(name);
        for (let i = 0; i < docs.length; i += 500) {
            await target.insertMany(docs.slice(i, i + 500), { ordered: true });
        }

        const indexes = await src.db.collection(name).listIndexes().toArray();
        for (const idx of indexes) {
            if (idx.name === '_id_') continue;
            const options = { ...idx };
            delete options.key;
            delete options.v;
            delete options.ns;
            await target.createIndex(idx.key, options);
        }

        const copied = await target.countDocuments();
        const match = copied === docs.length;
        if (!match) allMatch = false;
        console.log(`${match ? 'OK  ' : 'DIFF'} ${name.padEnd(26)} ${String(docs.length).padStart(5)} -> ${String(copied).padStart(5)}   indexes: ${indexes.length}`);
    }

    await src.close();
    await dst.close();
    console.log(allMatch ? '\nCOPY COMPLETE' : '\nCOPY FINISHED WITH DIFFERENCES');
})().catch((e) => {
    console.error('ERROR:', e.message || e);
    process.exit(1);
});