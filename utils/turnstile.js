// utils/turnstile.js — server-side check of Cloudflare Turnstile tokens (bot protection on public forms).
// The browser widget gives the user a single-use token; the server confirms it with Cloudflare
// BEFORE creating an account or sending any email.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;
let warnedMissingKey = false;

const verifyTurnstileToken = async (token, ip) => {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
    if (ip) body.append('remoteip', ip);
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`siteverify HTTP ${res.status}`);
    const data = await res.json();
    return { success: data.success === true, errorCodes: data['error-codes'] || [] };
};

// Express middleware. Expects req.body.turnstileToken (JSON body).
// Fails CLOSED: if Cloudflare can't be reached, the request is refused, not let through.
const requireTurnstile = async (req, res, next) => {
    if (!process.env.TURNSTILE_SECRET_KEY) {
        if (process.env.NODE_ENV === 'production') {
            console.error('[turnstile] TURNSTILE_SECRET_KEY is not set');
            return res.status(503).json({ success: false, message: 'Security check is not available. Please try again later.' });
        }
        if (!warnedMissingKey) {
            console.warn('[turnstile] TURNSTILE_SECRET_KEY not set: check skipped (development only)');
            warnedMissingKey = true;
        }
        return next();
    }

    const raw = req.body?.turnstileToken;
    const token = typeof raw === 'string' ? raw.trim() : '';
    if (!token || token.length > 2048) {
        return res.status(400).json({ success: false, message: 'Please complete the security check.' });
    }

    try {
        const { success, errorCodes } = await verifyTurnstileToken(token, req.ip);
        if (!success) {
            console.warn('[turnstile] rejected:', errorCodes.join(',') || 'unknown');
            return res.status(400).json({ success: false, message: 'Security check failed. Please try again.' });
        }
        delete req.body.turnstileToken; // controllers never see it
        return next();
    } catch (err) {
        console.error('[turnstile] verify error:', err.name);
        return res.status(503).json({ success: false, message: 'Security check is not available right now. Please try again.' });
    }
};

module.exports = { requireTurnstile, verifyTurnstileToken };