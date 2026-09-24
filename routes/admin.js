const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
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
} = require('../controllers/venueAdminController');
const {
  getAdminReviews,
  hideReview,
  restoreReview,
} = require('../controllers/reviewAdminController');
const upload = require('../middleware/upload');

// All admin routes require JWT + admin role
router.use(protect, adminOnly);

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

// POST /api/admin/venues
router.post('/venues', createVenue);

// PATCH /api/admin/venues/:id
router.patch('/venues/:id', updateVenue);

// POST /api/admin/venues/:id/photos
router.post('/venues/:id/photos', upload.array('photos', 5), uploadVenuePhotos);

// DELETE /api/admin/venues/:id/photos
router.delete('/venues/:id/photos', deleteVenuePhoto);

// PATCH /api/admin/venues/:id/photos/order
router.patch('/venues/:id/photos/order', reorderVenuePhotos);

// POST /api/admin/venues/:id/layout
router.post('/venues/:id/layout', upload.single('layout'), uploadCourtLayout);

// DELETE /api/admin/venues/:id/layout
router.delete('/venues/:id/layout', deleteCourtLayout);

// ─── Review Moderation ────────────────────────────────────────────────────────
// GET /api/admin/reviews
router.get('/reviews', getAdminReviews);

// PATCH /api/admin/reviews/:id/hide
router.patch('/reviews/:id/hide', hideReview);

// PATCH /api/admin/reviews/:id/restore
router.patch('/reviews/:id/restore', restoreReview);

module.exports = router;
