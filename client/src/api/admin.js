import api from './axios'

export const getAllBookings = (params) => api.get('/admin/bookings', { params })

export const getRevenueAnalytics = (days = 14) =>
  api.get('/admin/analytics/revenue', { params: { days } })

export const getPeakHours = (days = 14, venueId = '') =>
  api.get('/admin/analytics/peak-hours', { params: { days, venueId: venueId || undefined } })

export const getUtilization = (days = 14) =>
  api.get('/admin/analytics/utilization', { params: { days } })

export const approveBooking = (id) => api.patch(`/admin/bookings/${id}/approve`)
export const rejectBooking = (id) => api.patch(`/admin/bookings/${id}/reject`)
