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
  getMonthlyInsights,
} = require('../controllers/adminController');
const {
  getAdminVenues,
  createVenue,
  updateVenue,
  getVenueCourts,
  updateCourtStatus,
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
  verifyShopItemExists,
  uploadShopItemPhoto,
  deleteShopItemPhoto,
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
const {
  getPaymentInfo,
  getSettings,
  updateSettings,
  uploadPlatformQr,
  deletePlatformQr,
  generateStatements,
  listStatements,
  submittedCount,
  loadOwnStatementForUpload,
  uploadStatementReceipt,
  verifyStatement,
  rejectStatement,
} = require('../controllers/commissionController');
const upload = require('../middleware/upload');
const {
  getOwnerVenueEvents,
  getOwnerHiddenEventCount,
  createEvent,
  updateEvent,
  deleteEvent,
  verifyEventEditable,
  uploadEventPoster,
  deleteEventPoster,
  getAdminEvents,
  getAdminEventReviewCount,
  hideEvent,
  restoreEvent,
} = require('../controllers/eventController');

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

// GET /api/admin/insights/monthly
router.get('/insights/monthly', getMonthlyInsights);

// ─── Venue Management ────────────────────────────────────────────────────────
// GET /api/admin/venues
router.get('/venues', getAdminVenues);

// POST /api/admin/venues (Admin only)
router.post('/venues', adminOnly, createVenue);

// PATCH /api/admin/venues/:id (Venue access required)
router.patch('/venues/:id', requireVenueAccess('id'), updateVenue);

// GET /api/admin/venues/:id/courts (Venue access required)
router.get('/venues/:id/courts', requireVenueAccess('id'), getVenueCourts);

// PATCH /api/admin/venues/:id/courts/:courtId/status (Venue access required)
router.patch('/venues/:id/courts/:courtId/status', requireVenueAccess('id'), updateCourtStatus);

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

// POST /api/admin/venues/:id/shop-items/:itemId/photo (Venue access and item existence verified before file upload)
router.post(
  '/venues/:id/shop-items/:itemId/photo',
  requireVenueAccess('id'),
  verifyShopItemExists,
  upload.single('photo'),
  uploadShopItemPhoto
);

// DELETE /api/admin/venues/:id/shop-items/:itemId/photo (Venue access required)
router.delete(
  '/venues/:id/shop-items/:itemId/photo',
  requireVenueAccess('id'),
  verifyShopItemExists,
  deleteShopItemPhoto
);

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

// ─── Venue Events ──────────────────────────────────────────────────────────
// Owner: manage events of own venue (owners write, admins only moderate)
const ownerOnly = requireRole('venue_owner');
router.get('/events/hidden-count', ownerOnly, getOwnerHiddenEventCount);
router.get('/venues/:id/events', ownerOnly, requireVenueAccess('id'), getOwnerVenueEvents);
router.post('/venues/:id/events', ownerOnly, requireVenueAccess('id'), createEvent);
router.patch('/venues/:id/events/:eventId', ownerOnly, requireVenueAccess('id'), updateEvent);
router.delete('/venues/:id/events/:eventId', ownerOnly, requireVenueAccess('id'), deleteEvent);
router.post(
  '/venues/:id/events/:eventId/poster',
  ownerOnly,
  requireVenueAccess('id'),
  verifyEventEditable,
  upload.single('poster'),
  uploadEventPoster
);
router.delete(
  '/venues/:id/events/:eventId/poster',
  ownerOnly,
  requireVenueAccess('id'),
  verifyEventEditable,
  deleteEventPoster
);

// Admin: moderation (hide with reason / restore)
router.get('/events/review-count', adminOnly, getAdminEventReviewCount);
router.get('/events', adminOnly, getAdminEvents);
router.patch('/events/:eventId/hide', adminOnly, hideEvent);
router.patch('/events/:eventId/restore', adminOnly, restoreEvent);

// ─── Platform Commission ──────────────────────────────────────────────────────
// GET /api/admin/commission/payment-info
router.get('/commission/payment-info', getPaymentInfo);

// GET /api/admin/commission/settings (Admin only)
router.get('/commission/settings', adminOnly, getSettings);

// PATCH /api/admin/commission/settings (Admin only)
router.patch('/commission/settings', adminOnly, updateSettings);

// POST /api/admin/commission/settings/qr (Admin only)
router.post('/commission/settings/qr', adminOnly, upload.single('qr'), uploadPlatformQr);

// DELETE /api/admin/commission/settings/qr (Admin only)
router.delete('/commission/settings/qr', adminOnly, deletePlatformQr);

// POST /api/admin/commission/statements/generate (Admin only)
router.post('/commission/statements/generate', adminOnly, generateStatements);

// GET /api/admin/commission/statements
router.get('/commission/statements', listStatements);

// GET /api/admin/commission/statements/submitted-count (Admin only)
router.get('/commission/statements/submitted-count', adminOnly, submittedCount);

// POST /api/admin/commission/statements/:id/receipt (Owner only)
router.post(
  '/commission/statements/:id/receipt',
  loadOwnStatementForUpload,
  upload.single('receipt'),
  uploadStatementReceipt
);

// PATCH /api/admin/commission/statements/:id/verify (Admin only)
router.patch('/commission/statements/:id/verify', adminOnly, verifyStatement);

// PATCH /api/admin/commission/statements/:id/reject (Admin only)
router.patch('/commission/statements/:id/reject', adminOnly, rejectStatement);

module.exports = router;

