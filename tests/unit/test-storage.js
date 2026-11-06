// Tests utils/storage.js with both drivers. Creates and deletes its own test files only.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const storage = require('../../utils/storage');
const cloudinary = require('cloudinary').v2;

let fails = 0;
const check = (name, ok, got) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${got !== undefined ? '  -> ' + JSON.stringify(got) : ''}`);
    if (!ok) fails++;
};

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JPG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const FAKE = Buffer.from('<?php echo "hi"; ?> pretending to be a png');
const existsOnCloud = async (id, type) => {
    try { await cloudinary.api.resource(id, { type }); return true; } catch { return false; }
};

(async () => {
    console.log('--- file type detection');
    check('PNG detected', storage.detectImageType(PNG) === 'png');
    check('JPEG detected', storage.detectImageType(JPG_HEAD) === 'jpg');
    check('fake image rejected', storage.detectImageType(FAKE) === null);

    console.log('--- local driver');
    process.env.STORAGE_DRIVER = 'local';
    const local = await storage.saveFile(PNG, 'venue-photo', 'test');
    const localPath = path.join(__dirname, '..', '..', 'uploads', path.basename(local));
    check('local save returns /uploads/ path', /^\/uploads\/test-\d+-\d+\.png$/.test(local), local);
    check('local file exists', fs.existsSync(localPath));
    check('local delete', (await storage.deleteFile(local)) === true && !fs.existsSync(localPath));
    let refused = false;
    try { await storage.saveFile(FAKE, 'venue-photo', 'test'); } catch (e) { refused = e.statusCode === 400; }
    check('fake image refused with 400', refused);
    check('path traversal ignored', (await storage.deleteFile('/uploads/..')) === false &&
        fs.existsSync(path.join(__dirname, '..', '..', 'server.js')));
    check('external URL never deleted', (await storage.deleteFile('https://images.unsplash.com/photo-123.jpg')) === false);
    check('local path not signed as Cloudinary', storage.signPrivateUrl(local) === null);

    console.log('--- cloudinary driver');
    process.env.STORAGE_DRIVER = 'cloudinary';
    check('config check', storage.checkStorageConfig() === 'cloudinary');

    const pub = await storage.saveFile(PNG, 'venue-photo', 'test');
    check('public save returns https URL', pub.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`), pub);
    check('public URL loads (200)', (await fetch(pub)).status === 200);
    const pubId = storage._parseStored(pub).publicId;
    check('public id is courtease/venue-photo/test-...', pubId.startsWith('courtease/venue-photo/test-'), pubId);
    check('public delete', (await storage.deleteFile(pub)) === true && !(await existsOnCloud(pubId, 'upload')));

    const priv = await storage.saveFile(PNG, 'booking-receipt', 'test');
    check('private save returns cld-private: marker', /^cld-private:courtease\/booking-receipt\/test-\d+-\d+\.png$/.test(priv), priv);
    check('marker alone is not a URL', !priv.startsWith('http'));
    const privId = storage._parseStored(priv).publicId;
    const signed = storage.signPrivateUrl(priv);
    const r = await fetch(signed);
    check('signed link loads (200 image)', r.status === 200 && (r.headers.get('content-type') || '').startsWith('image/'), r.status);
    const hours = (Number(new URL(signed).searchParams.get('expires_at')) * 1000 - Date.now()) / 3600000;
    check('link expires in 2-3 hours', hours > 1.9 && hours <= 3, Number(hours.toFixed(2)));
    check('private delete', (await storage.deleteFile(priv)) === true && !(await existsOnCloud(privId, 'private')));
    check('signed link dead after delete', (await fetch(signed)).status >= 400);

    console.log(fails === 0 ? '\nALL PASSED' : `\n${fails} FAILED`);
})().catch((e) => { console.error('ERROR:', e); process.exit(1); });

