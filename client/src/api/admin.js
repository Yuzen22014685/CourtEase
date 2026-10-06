import api from './axios'

export const getAllBookings = (params) => api.get('/admin/bookings', { params })

export const getRevenueAnalytics = (days = 14) =>
  api.get('/admin/analytics/revenue', { params: { days } })

export const getPeakHours = (days = 14, venueId = '') =>
  api.get('/admin/analytics/peak-hours', { params: { days, venueId: venueId || undefined } })

export const getUtilization = (days = 14) =>
  api.get('/admin/analytics/utilization', { params: { days } })

export const approveBooking = (id) => api.patch(`/admin/bookings/${id}/approve`)
export const rejectBooking = (id, reason) => api.patch(`/admin/bookings/${id}/reject`, { reason })
export const getPendingCount = () => api.get('/admin/bookings/pending-count')

// Venue management
export const getAdminVenues = () => api.get('/admin/venues')
export const createVenue = (data) => api.post('/admin/venues', data)
export const updateVenue = (id, data) => api.patch(`/admin/venues/${id}`, data)
export const uploadVenuePhotos = (id, formData) =>
  api.post(`/admin/venues/${id}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const deleteVenuePhoto = (id, photo) =>
  api.delete(`/admin/venues/${id}/photos`, { data: { photo } })
export const reorderVenuePhotos = (id, photos) =>
  api.patch(`/admin/venues/${id}/photos/order`, { photos })
export const uploadCourtLayout = (id, formData) =>
  api.post(`/admin/venues/${id}/layout`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const deleteCourtLayout = (id) =>
  api.delete(`/admin/venues/${id}/layout`)

// Review moderation
export const getAdminReviews = (params) => api.get('/admin/reviews', { params })
export const hideReview = (id, reason) => api.patch(`/admin/reviews/${id}/hide`, { reason })
export const restoreReview = (id) => api.patch(`/admin/reviews/${id}/restore`)

// Owner management
export const getOwners = () => api.get('/admin/owners')
export const createOwner = (data) => api.post('/admin/owners', data)
export const resendOwnerInvite = (id) => api.post(`/admin/owners/${id}/resend-invite`)
export const updateVenueOwner = (id, ownerId) => api.patch(`/admin/venues/${id}/owner`, { ownerId })


