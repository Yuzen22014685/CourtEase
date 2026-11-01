const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getVenues,
  getVenueById,
  getVenueAvailability,
  createBooking,
  getMyBookings,
  cancelBooking,
  rescheduleBooking,
  verifyBookingForReceiptUpload,
  uploadReceipt,
  getBookingPaymentInfo,
  createReview,
  getVenueReviews,
  getPublicVenueShopItems,
} = require('../controllers/playerController');
const {
  getMyNotifications,
  markAsRead,
  getUnreadCount,
} = require('../controllers/notificationController');

// Rate limiter for public venue browsing
const publicVenueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

// Venue routes (public)
router.get('/venues', publicVenueLimiter, getVenues);
router.get('/venues/:id', publicVenueLimiter, getVenueById);
router.get('/venues/:id/availability', publicVenueLimiter, getVenueAvailability);
router.get('/venues/:id/reviews', publicVenueLimiter, getVenueReviews);
router.get('/venues/:id/shop-items', publicVenueLimiter, getPublicVenueShopItems);

// Booking routes (protected)
router.post('/bookings', protect, createBooking);
router.get('/bookings/me', protect, getMyBookings);
router.get('/bookings/:id/payment-info', protect, getBookingPaymentInfo);
router.patch('/bookings/:id/cancel', protect, cancelBooking);
router.patch('/bookings/:id/reschedule', protect, rescheduleBooking);
router.post(
  '/bookings/:id/upload-receipt',
  protect,
  verifyBookingForReceiptUpload,
  upload.single('receipt'),
  uploadReceipt
);
router.post('/bookings/:id/review', protect, createReview);

// Notification routes (protected)
router.get('/notifications', protect, getMyNotifications);
router.get('/notifications/unread-count', protect, getUnreadCount);
router.patch('/notifications/:id/read', protect, markAsRead);

module.exports = router;
