import api from './axios'

export const getAllBookings = (params) => api.get('/admin/bookings', { params })

export const getRevenueAnalytics = (days = 14) =>
  api.get('/admin/analytics/revenue', { params: { days } })

export const getPeakHours = (days = 14, venueId = '') =>
  api.get('/admin/analytics/peak-hours', { params: { days, venueId: venueId || undefined } })

export const getUtilization = (days = 14) =>
  api.get('/admin/analytics/utilization', { params: { days } })

export const getMonthlyInsights = (month, venueId) =>
  api.get('/admin/insights/monthly', {
    params: {
      month: month || undefined,
      venueId: venueId || undefined,
    },
  })

export const approveBooking = (id) => api.patch(`/admin/bookings/${id}/approve`)
export const rejectBooking = (id, reason) => api.patch(`/admin/bookings/${id}/reject`, { reason })
export const requestNewReceipt = (id, reason) => api.patch(`/admin/bookings/${id}/request-receipt`, { reason })
export const getPendingCount = () => api.get('/admin/bookings/pending-count')

// Venue management
export const getAdminVenues = () => api.get('/admin/venues')
export const createVenue = (data) => api.post('/admin/venues', data)
export const updateVenue = (id, data) => api.patch(`/admin/venues/${id}`, data)
export const getVenueCourts = (venueId) => api.get(`/admin/venues/${venueId}/courts`)
export const updateCourtStatus = (venueId, courtId, status) =>
  api.patch(`/admin/venues/${venueId}/courts/${courtId}/status`, { status })
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
export const uploadPaymentQr = (id, formData) =>
  api.post(`/admin/venues/${id}/payment-qr`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const deletePaymentQr = (id) =>
  api.delete(`/admin/venues/${id}/payment-qr`)

// Review moderation
export const getAdminReviews = (params) => api.get('/admin/reviews', { params })
export const hideReview = (id, reason) => api.patch(`/admin/reviews/${id}/hide`, { reason })
export const restoreReview = (id) => api.patch(`/admin/reviews/${id}/restore`)

// Owner management
export const getOwners = () => api.get('/admin/owners')
export const createOwner = (data) => api.post('/admin/owners', data)
export const resendOwnerInvite = (id) => api.post(`/admin/owners/${id}/resend-invite`)
export const updateVenueOwner = (id, ownerId) => api.patch(`/admin/venues/${id}/owner`, { ownerId })

// Shop items
export const getShopItems = (venueId) => api.get(`/admin/venues/${venueId}/shop-items`)
export const createShopItem = (venueId, data) => api.post(`/admin/venues/${venueId}/shop-items`, data)
export const updateShopItem = (venueId, itemId, data) => api.patch(`/admin/venues/${venueId}/shop-items/${itemId}`, data)
export const deleteShopItem = (venueId, itemId) => api.delete(`/admin/venues/${venueId}/shop-items/${itemId}`)
export const uploadShopItemPhoto = (venueId, itemId, formData) =>
  api.post(`/admin/venues/${venueId}/shop-items/${itemId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const deleteShopItemPhoto = (venueId, itemId) =>
  api.delete(`/admin/venues/${venueId}/shop-items/${itemId}/photo`)

// Venue events (Owner)
export const getOwnerVenueEvents = (venueId) => api.get(`/admin/venues/${venueId}/events`)
export const createVenueEvent = (venueId, data) => api.post(`/admin/venues/${venueId}/events`, data)
export const updateVenueEvent = (venueId, eventId, data) =>
  api.patch(`/admin/venues/${venueId}/events/${eventId}`, data)
export const deleteVenueEvent = (venueId, eventId) =>
  api.delete(`/admin/venues/${venueId}/events/${eventId}`)
export const uploadEventPoster = (venueId, eventId, file) => {
  const formData = file instanceof FormData ? file : (() => {
    const fd = new FormData()
    fd.append('poster', file)
    return fd
  })()
  return api.post(`/admin/venues/${venueId}/events/${eventId}/poster`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const deleteEventPoster = (venueId, eventId) =>
  api.delete(`/admin/venues/${venueId}/events/${eventId}/poster`)
export const getOwnerHiddenEventCount = () => api.get('/admin/events/hidden-count')

// Event moderation (Admin)
export const getAdminEvents = (params) => api.get('/admin/events', { params })
export const hideEvent = (eventId, reason) => api.patch(`/admin/events/${eventId}/hide`, { reason })
export const restoreEvent = (eventId) => api.patch(`/admin/events/${eventId}/restore`)
export const getAdminEventReviewCount = () => api.get('/admin/events/review-count')

// Platform Commission
export const getCommissionSettings = () => api.get('/admin/commission/settings')
export const updateCommissionSettings = (data) => api.patch('/admin/commission/settings', data)
export const uploadCommissionQr = (formData) =>
  api.post('/admin/commission/settings/qr', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const deleteCommissionQr = () => api.delete('/admin/commission/settings/qr')
export const generateCommissionStatements = (month) =>
  api.post('/admin/commission/statements/generate', { month })
export const getCommissionStatements = (params) =>
  api.get('/admin/commission/statements', { params })
export const getSubmittedCommissionCount = () =>
  api.get('/admin/commission/statements/submitted-count')
export const verifyCommissionStatement = (id) =>
  api.patch(`/admin/commission/statements/${id}/verify`)
export const rejectCommissionStatement = (id, reason) =>
  api.patch(`/admin/commission/statements/${id}/reject`, { reason })
export const getCommissionPaymentInfo = () =>
  api.get('/admin/commission/payment-info')
export const uploadCommissionReceipt = (id, formData) =>
  api.post(`/admin/commission/statements/${id}/receipt`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
