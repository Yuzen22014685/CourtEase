// File storage for uploads: local disk (development / viva backup) or Cloudinary (deployment).
// Chosen by STORAGE_DRIVER = 'local' (default) | 'cloudinary'.
//
// Stored string formats (what goes in MongoDB):
//   local (public or private) : '/uploads/<file>'                              (existing format, unchanged)
//   cloudinary, public        : 'https://res.cloudinary.com/<cloud>/image/upload/v123/courtease/<kind>/<name>.png'
//   cloudinary, private       : 'cld-private:courtease/<kind>/<name>.png'      (a marker, never a usable URL)
//
// Private files are only ever shown through utils/signedUrl.js (expiring links).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const PRIVATE_PREFIX = 'cld-private:';
const PRIVATE_TTL_S = 2 * 60 * 60; // private links valid at least 2 hours
const ROUND_S = 60 * 60;           // expiry rounded up to the hour (same link for an hour -> browser caching)

const PUBLIC_KINDS = new Set(['venue-photo', 'venue-layout', 'venue-qr', 'shop-item', 'platform-qr', 'event-poster']);
const PRIVATE_KINDS = new Set(['booking-receipt', 'commission-receipt']);

const getDriver = () => (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();
const rootFolder = () =>
    (process.env.CLOUDINARY_FOLDER || 'courtease').replace(/[^A-Za-z0-9_-]/g, '') || 'courtease';

let configured = false;
const ensureCloudinary = () => {
    if (configured) return;
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error('Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)');
    }
    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
        secure: true,
    });
    configured = true;
};

// Call once at server start: fails fast if the chosen driver cannot work.
const checkStorageConfig = () => {
    const driver = getDriver();
    if (driver === 'local') return 'local';
    if (driver === 'cloudinary') {
        ensureCloudinary();
        return 'cloudinary';
    }
    throw new Error(`Unknown STORAGE_DRIVER "${driver}" (use "local" or "cloudinary")`);
};

// Real file type from the first bytes (the browser-declared mimetype can be faked).
const detectImageType = (buf) => {
    if (!Buffer.isBuffer(buf) || buf.length < 8) return null;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
        buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
    if (isPng) return 'png';
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    return null;
};

const badRequest = (message) => {
    const err = new Error(message);
    err.statusCode = 400;
    err.code = 'INVALID_IMAGE';
    return err;
};

const safePrefix = (prefix) =>
    String(prefix || 'platform').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'platform';
const uniqueName = (prefix) => `${safePrefix(prefix)}-${Date.now()}-${crypto.randomInt(1e9)}`;

const uploadBuffer = (buffer, options) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (err, result) =>
            err ? reject(err) : resolve(result));
        stream.end(buffer);
    });

/**
 * Save an uploaded image and return the string to store in MongoDB.
 * @param {Buffer} buffer  file contents (multer memoryStorage: req.file.buffer)
 * @param {string} kind    one of PUBLIC_KINDS / PRIVATE_KINDS
 * @param {string} [prefix] e.g. the venue/booking id, used in the file name
 */
const saveFile = async (buffer, kind, prefix) => {
    if (!PUBLIC_KINDS.has(kind) && !PRIVATE_KINDS.has(kind)) {
        throw new Error(`Unknown upload kind "${kind}"`);
    }
    const ext = detectImageType(buffer);
    if (!ext) throw badRequest('Only .png and .jpg images are allowed');
    const name = uniqueName(prefix);

    if (getDriver() === 'cloudinary') {
        ensureCloudinary();
        const isPrivate = PRIVATE_KINDS.has(kind);
        const result = await uploadBuffer(buffer, {
            public_id: `${rootFolder()}/${kind}/${name}`,
            type: isPrivate ? 'private' : 'upload',
            resource_type: 'image',
            overwrite: false,
        });
        return isPrivate ? `${PRIVATE_PREFIX}${result.public_id}.${result.format}` : result.secure_url;
    }

    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${name}.${ext}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), buffer, { flag: 'wx' });
    return `/uploads/${filename}`;
};

// Works out where a stored string lives. Returns null for anything we must never touch
// (external URLs such as the Unsplash seed photos, another Cloudinary account, junk).
const parseStored = (stored) => {
    if (typeof stored !== 'string' || !stored) return null;
    const clean = stored.split('?')[0];

    if (clean.startsWith('/uploads/') || clean.startsWith('uploads/')) {
        return { where: 'local', filename: path.basename(clean) };
    }
    if (clean.startsWith(PRIVATE_PREFIX)) {
        const m = clean.slice(PRIVATE_PREFIX.length).match(/^([A-Za-z0-9_\-/]+)\.(png|jpg|jpeg)$/);
        return m ? { where: 'cloudinary', type: 'private', publicId: m[1], format: m[2] } : null;
    }
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const base = `https://res.cloudinary.com/${cloud}/image/upload/`;
    if (cloud && clean.startsWith(base)) {
        const rest = clean.slice(base.length).replace(/^v\d+\//, '');
        const m = rest.match(/^([A-Za-z0-9_\-/]+)\.(png|jpg|jpeg)$/);
        return m ? { where: 'cloudinary', type: 'upload', publicId: m[1], format: m[2] } : null;
    }
    return null;
};

/**
 * Delete a stored file (best effort, never throws). Handles old '/uploads/' paths
 * whichever driver is active, so replacing an old local photo still cleans it up.
 * @returns {Promise<boolean>} true if something was deleted
 */
const deleteFile = async (stored) => {
    const p = parseStored(stored);
    if (!p) return false;
    try {
        if (p.where === 'local') {
            if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(p.filename)) return false; // blocks '.', '..', odd names
            await fs.promises.unlink(path.join(UPLOAD_DIR, p.filename));
            return true;
        }
        ensureCloudinary();
        const res = await cloudinary.uploader.destroy(p.publicId, {
            type: p.type,
            resource_type: 'image',
            invalidate: true,
        });
        return Boolean(res && res.result === 'ok');
    } catch (err) {
        if (!err || err.code !== 'ENOENT') console.warn('[storage] delete failed:', (err && err.message) || err);
        return false;
    }
};

/**
 * Expiring signed link for a private Cloudinary file ('cld-private:...').
 * Returns null for anything else (local paths are signed by utils/signedUrl.js as before).
 */
const signPrivateUrl = (stored) => {
    const p = parseStored(stored);
    if (!p || p.where !== 'cloudinary' || p.type !== 'private') return null;
    try {
        ensureCloudinary();
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = Math.ceil((now + PRIVATE_TTL_S) / ROUND_S) * ROUND_S;
        return cloudinary.utils.private_download_url(p.publicId, p.format, {
            type: 'private',
            resource_type: 'image',
            expires_at: expiresAt,
        });
    } catch (err) {
        console.warn('[storage] cannot sign private file:', (err && err.message) || err);
        return null;
    }
};

module.exports = {
    saveFile,
    deleteFile,
    signPrivateUrl,
    detectImageType,
    checkStorageConfig,
    PRIVATE_PREFIX,
    PUBLIC_KINDS,
    PRIVATE_KINDS,
    _parseStored: parseStored, // exported for tests only
};