import api from './axios'

export const login    = (credentials) => api.post('/auth/login', credentials)
export const register = (data)        => api.post('/auth/register', data)

/** Fetch full profile for the logged-in player (address, bankAccount, etc.) */
export const getProfile = ()     => api.get('/auth/profile')

/** Update address and/or bankAccount for the logged-in player */
export const updateProfile = (data) => api.patch('/auth/profile', data)
