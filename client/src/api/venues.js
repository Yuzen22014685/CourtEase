import api from './axios'

export const getVenues = (params) => api.get('/venues', { params })

export const getVenueById = (id) => api.get(`/venues/${id}`)

export const getVenueAvailability = (id, date) =>
  api.get(`/venues/${id}/availability`, { params: { date } })

export const getVenueReviews = (id, page = 1) =>
  api.get(`/venues/${id}/reviews`, { params: { page } })

export const getVenueShopItems = (id) => api.get(`/venues/${id}/shop-items`)

export const getPublicEvents = () => api.get('/events')

export const getVenueEvents = (venueId) => api.get(`/venues/${venueId}/events`)
