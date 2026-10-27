// middleware/privateUploads.js — guards GET /uploads/<file>.
//
// DEFAULT DENY: a file is PUBLIC only if a public field references it
// (venue photos, venue layout, venue payment QR, shop item photo, platform payment QR).
// Everything else — booking receipts, commission receipts, orphaned files — needs a valid
// signed URL (?exp=&sig=), which only authorised API responses contain (see utils/signedUrl.js).

const Venue = require('../models/Venue');
const ShopItem = require('../models/ShopItem');
const PlatformSettings = require('../models/PlatformSettings');
const { verifyUploadSignature } = require('../utils/signedUrl');

// Only plain file names directly inside uploads/ (no sub-folders, no encoded characters).
const FILE_RE = /^\/[A-Za-z0-9._-]+$/;

// Cache PUBLIC results only (file names are unique, so a public file stays public).
// Private results are always re-checked against the database.
const publicCache = new Set();
const CACHE_LIMIT = 5000;

const isPublicFile = async (name) => {
    if (publicCache.has(name)) return true;
    const forms = [`/uploads/${name}`, `uploads/${name}`, name];
    const isPublic = Boolean(
        (await Venue.exists({
            $or: [
                { photos: { $in: forms } },
                { layoutImage: { $in: forms } },
                { 'paymentInfo.duitNowQr': { $in: forms } },
            ],
        })) ||
        (await ShopItem.exists({ photo: { $in: forms } })) ||
        (await PlatformSettings.exists({ 'paymentInfo.duitNowQr': { $in: forms } }))
    );
    if (isPublic) {
        if (publicCache.size >= CACHE_LIMIT) publicCache.clear();
        publicCache.add(name);
    }
    return isPublic;
};

const privateUploads = async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    // Anything that is not a simple file name is refused here, never passed to express.static
    // (prevents bypassing the check with encoded paths like /uploads/%36abc.png).
    if (!FILE_RE.test(req.path)) {
        return res.status(404).json({ success: false, message: 'File not found' });
    }

    const name = req.path.slice(1);
    try {
        if (await isPublicFile(name)) return next();
    } catch (err) {
        return next(err);
    }

    if (verifyUploadSignature(`/uploads/${name}`, req.query.exp, req.query.sig)) {
        return next();
    }

    return res.status(403).json({ success: false, message: 'This file is private.' });
};

module.exports = privateUploads;