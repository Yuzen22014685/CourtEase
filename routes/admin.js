const express = require('express');
const router = express.Router();
const { protect, adminOnly, requireRole } = require('../middleware/auth');
const { requireVenueAccess } = require('../utils/venueAccess');
const {
  getPendingCount,
  getAllBookings,
  getRevenueAnalytics,
  getPeakHours,
  getUtilization,
  approveBooking,
  rejectBooking,
} = require('../controllers/adminController');
const {
  getAdminVenues,
  createVenue,
  updateVenue,
  uploadVenuePhotos,
  deleteVenuePhoto,
  reorderVenuePhotos,
  uploadCourtLayout,
  deleteCourtLayout,
  uploadPaymentQr,
  deletePaymentQr,
  getVenueShopItems,
  createShopItem,
  updateShopItem,
  deleteShopItem,
} = require('../controllers/venueAdminController');
const {
  getAdminReviews,
  hideReview,
  restoreReview,
} = require('../controllers/reviewAdminController');
const {
  getOwners,
  createOwner,
  resendOwnerInvite,
  updateVenueOwner,
} = require('../controllers/ownerAdminController');
const upload = require('../middleware/upload');

// Base guard: all routes require JWT and role of admin or venue_owner
router.use(protect, requireRole('admin', 'venue_owner'));

// GET /api/admin/bookings
router.get('/bookings', getAllBookings);

// GET /api/admin/bookings/pending-count
router.get('/bookings/pending-count', getPendingCount);

// PATCH /api/admin/bookings/:id/approve
router.patch('/bookings/:id/approve', approveBooking);

// PATCH /api/admin/bookings/:id/reject
router.patch('/bookings/:id/reject', rejectBooking);

// GET /api/admin/analytics/revenue
router.get('/analytics/revenue', getRevenueAnalytics);

// GET /api/admin/analytics/peak-hours
router.get('/analytics/peak-hours', getPeakHours);

// GET /api/admin/analytics/utilization
router.get('/analytics/utilization', getUtilization);

// ─── Venue Management ────────────────────────────────────────────────────────
// GET /api/admin/venues
router.get('/venues', getAdminVenues);

// POST /api/admin/venues (Admin only)
router.post('/venues', adminOnly, createVenue);

// PATCH /api/admin/venues/:id (Venue access required)
router.patch('/venues/:id', requireVenueAccess('id'), updateVenue);

// POST /api/admin/venues/:id/photos (Venue access required before file upload)
router.post('/venues/:id/photos', requireVenueAccess('id'), upload.array('photos', 5), uploadVenuePhotos);

// DELETE /api/admin/venues/:id/photos (Venue access required)
router.delete('/venues/:id/photos', requireVenueAccess('id'), deleteVenuePhoto);

// PATCH /api/admin/venues/:id/photos/order (Venue access required)
router.patch('/venues/:id/photos/order', requireVenueAccess('id'), reorderVenuePhotos);

// POST /api/admin/venues/:id/layout (Venue access required before file upload)
router.post('/venues/:id/layout', requireVenueAccess('id'), upload.single('layout'), uploadCourtLayout);

// DELETE /api/admin/venues/:id/layout (Venue access required)
router.delete('/venues/:id/layout', requireVenueAccess('id'), deleteCourtLayout);

// POST /api/admin/venues/:id/payment-qr (Venue access required before file upload)
router.post('/venues/:id/payment-qr', requireVenueAccess('id'), upload.single('qr'), uploadPaymentQr);

// DELETE /api/admin/venues/:id/payment-qr (Venue access required)
router.delete('/venues/:id/payment-qr', requireVenueAccess('id'), deletePaymentQr);

// ─── Shop Items ───────────────────────────────────────────────────────────────
// GET /api/admin/venues/:id/shop-items (Venue access required)
router.get('/venues/:id/shop-items', requireVenueAccess('id'), getVenueShopItems);

// POST /api/admin/venues/:id/shop-items (Venue access required)
router.post('/venues/:id/shop-items', requireVenueAccess('id'), createShopItem);

// PATCH /api/admin/venues/:id/shop-items/:itemId (Venue access required)
router.patch('/venues/:id/shop-items/:itemId', requireVenueAccess('id'), updateShopItem);

// DELETE /api/admin/venues/:id/shop-items/:itemId (Venue access required)
router.delete('/venues/:id/shop-items/:itemId', requireVenueAccess('id'), deleteShopItem);

// PATCH /api/admin/venues/:id/owner (Admin only)
router.patch('/venues/:id/owner', adminOnly, updateVenueOwner);

// ─── Owner Management ──────────────────────────────────────────────────────────
// GET /api/admin/owners (Admin only)
router.get('/owners', adminOnly, getOwners);

// POST /api/admin/owners (Admin only)
router.post('/owners', adminOnly, createOwner);

// POST /api/admin/owners/:id/resend-invite (Admin only)
router.post('/owners/:id/resend-invite', adminOnly, resendOwnerInvite);

// ─── Review Moderation ────────────────────────────────────────────────────────
// GET /api/admin/reviews
router.get('/reviews', getAdminReviews);

// PATCH /api/admin/reviews/:id/hide (Admin only)
router.patch('/reviews/:id/hide', adminOnly, hideReview);

// PATCH /api/admin/reviews/:id/restore (Admin only)
router.patch('/reviews/:id/restore', adminOnly, restoreReview);

module.exports = router;
