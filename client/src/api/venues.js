import api from './axios'

export const getVenues = (params) => api.get('/venues', { params })

export const getVenueById = (id) => api.get(`/venues/${id}`)

export const getVenueAvailability = (id, date) =>
  api.get(`/venues/${id}/availability`, { params: { date } })

export const getVenueReviews = (id, page = 1) =>
  api.get(`/venues/${id}/reviews`, { params: { page } })
