const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getAllBookings,
  getRevenueAnalytics,
  getPeakHours,
  getUtilization,
  approveBooking,
  rejectBooking,
} = require('../controllers/adminController');

// All admin routes require JWT + admin role
router.use(protect, adminOnly);

// GET /api/admin/bookings
router.get('/bookings', getAllBookings);

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

module.exports = router;
