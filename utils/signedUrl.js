// utils/signedUrl.js - short-lived signed URLs for private files (payment receipts).
// Pure helper: no database access, safe to require from models.
//   '/uploads/...'    (local disk)        -> our own HMAC link, checked by middleware/privateUploads.js
//   'cld-private:...' (Cloudinary private) -> Cloudinary expiring link, made by utils/storage.js

const crypto = require('crypto');
const { signPrivateUrl, PRIVATE_PREFIX } = require('./storage');

const TTL_MS = 2 * 60 * 60 * 1000;   // a link is valid for at least 2 hours
const ROUND_MS = 60 * 60 * 1000;     // expiry rounded up to the hour, so the URL stays the same
// within that hour and the browser can cache the image

let cachedKey = null;

// Derive a separate key from the secret, so upload links never share a key with login tokens.
const getKey = () => {
    if (cachedKey) return cachedKey;
    const base = process.env.UPLOAD_URL_SECRET || process.env.JWT_SECRET;
    if (!base) throw new Error('UPLOAD_URL_SECRET or JWT_SECRET must be set');
    cachedKey = crypto.createHmac('sha256', base).update('courtease-upload-url-v1').digest();
    return cachedKey;
};

const makeSig = (pathname, exp) =>
    crypto.createHmac('sha256', getKey()).update(`${pathname}:${exp}`).digest('base64url');

// '/uploads/x.png'        -> '/uploads/x.png?exp=<ms>&sig=<hmac>'
// 'cld-private:a/b.png'   -> 'https://api.cloudinary.com/...&expires_at=...&signature=...'
// Anything else is returned unchanged.
const signUploadPath = (p) => {
    if (typeof p !== 'string') return p;
    if (p.startsWith(PRIVATE_PREFIX)) {
        // If Cloudinary is not configured the marker is returned as-is: it is not a usable URL,
        // so nothing leaks, and the booking still shows that a receipt exists.
        return signPrivateUrl(p) || p;
    }
    if (!p.startsWith('/uploads/')) return p;
    const pathname = p.split('?')[0];
    const exp = Math.ceil((Date.now() + TTL_MS) / ROUND_MS) * ROUND_MS;
    return `${pathname}?exp=${exp}&sig=${makeSig(pathname, exp)}`;
};

// True only if sig matches this exact pathname + exp and the link has not expired.
const verifyUploadSignature = (pathname, exp, sig) => {
    if (typeof exp !== 'string' || typeof sig !== 'string' || !/^\d{10,16}$/.test(exp)) return false;
    if (Number(exp) < Date.now()) return false;
    const expected = Buffer.from(makeSig(pathname, exp));
    const given = Buffer.from(sig);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

module.exports = { signUploadPath, verifyUploadSignature };