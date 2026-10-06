import api from './axios'

export const createBooking = (data) => api.post('/bookings', data)

export const getMyBookings = () => api.get('/bookings/me')

export const cancelBooking = (id) => api.patch(`/bookings/${id}/cancel`)

export const rescheduleBooking = (id, data) => api.patch(`/bookings/${id}/reschedule`, data)

export const uploadReceipt = (id, formData) => api.post(`/bookings/${id}/upload-receipt`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})

export const submitReview = (id, data) => api.post(`/bookings/${id}/review`, data)

export const getBookingPaymentInfo = (id) => api.get(`/bookings/${id}/payment-info`)
