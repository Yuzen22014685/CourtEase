const express = require('express');
const router = express.Router();
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

// Venue routes (public)
router.get('/venues', getVenues);
router.get('/venues/:id', getVenueById);
router.get('/venues/:id/availability', getVenueAvailability);
router.get('/venues/:id/reviews', getVenueReviews);
router.get('/venues/:id/shop-items', getPublicVenueShopItems);

// Booking routes (protected)
router.post('/bookings', protect, createBooking);
router.get('/bookings/me', protect, getMyBookings);
router.get('/bookings/:id/payment-info', protect, getBookingPaymentInfo);
router.patch('/bookings/:id/cancel', protect, cancelBooking);
router.patch('/bookings/:id/reschedule', protect, rescheduleBooking);
router.post('/bookings/:id/upload-receipt', protect, upload.single('receipt'), uploadReceipt);
router.post('/bookings/:id/review', protect, createReview);

// Notification routes (protected)
router.get('/notifications', protect, getMyNotifications);
router.get('/notifications/unread-count', protect, getUnreadCount);
router.patch('/notifications/:id/read', protect, markAsRead);

module.exports = router;
