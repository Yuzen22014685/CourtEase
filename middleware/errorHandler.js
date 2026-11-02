/**
 * Centralized error handler — must be the last middleware registered in server.js.
 *
 * Client errors (4xx) keep their message: those messages are written for the user.
 * Server errors (5xx) never show internal details in production (provider messages,
 * file paths, stack traces). The full error is logged on the server instead.
 * An error may opt in to showing its message on a 5xx by setting err.expose = true
 * (used for user-friendly messages such as "The assistant is busy right now").
 */

// Hide ids and tokens in logged paths (e.g. /verify-email/<token>)
const safePath = (url) => String(url || '').split('?')[0].replace(/[a-f0-9]{24,}/gi, ':id');

// Express recognises an error handler by its 4 parameters, so _next must stay.
const errorHandler = (err, req, res, _next) => {
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    return res.status(409).json({ success: false, message: `Duplicate value for field: ${field}` });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') || 'Invalid data' });
  }

  // Invalid id or value in a query (e.g. a malformed ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ${err.path || 'value'}` });
  }

  // Body parser: malformed JSON or a body that is too large
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large' });
  }

  // Multer errors (file size, unexpected fields, file count)
  if (err.name === 'MulterError' || (err.message && err.message.includes('format allowed'))) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const explicit = Number(err.status || err.statusCode);
  const status =
    explicit >= 400 && explicit < 600 ? explicit : res.statusCode >= 400 ? res.statusCode : 500;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${safePath(req.originalUrl)} -> ${status}:`, err.stack || err.message);
    const isProduction = process.env.NODE_ENV === 'production';
    const showMessage = !isProduction || err.expose === true;
    return res.status(status).json({
      success: false,
      message: showMessage && err.message ? err.message : 'Something went wrong on our side. Please try again.',
      ...(isProduction ? {} : { stack: err.stack }),
    });
  }

  return res.status(status).json({ success: false, message: err.message || 'Request failed' });
};

module.exports = errorHandler;