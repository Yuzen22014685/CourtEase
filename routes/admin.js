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
} = require('../controllers/venueAdminController');
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

module.exports = router;
