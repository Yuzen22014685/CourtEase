import api from './axios'

export const login    = (credentials) => api.post('/auth/login', credentials)
export const register = (data)        => api.post('/auth/register', data)

/** Fetch full profile for the logged-in player */
export const getProfile = ()     => api.get('/auth/profile')

/** Update profile details for the logged-in player */
export const updateProfile = (data) => api.patch('/auth/profile', data)

/** Verify email token */
export const verifyEmail = (token) => api.get(`/auth/verify-email/${token}`)

/** Resend verification email */
export const resendVerification = (email) => api.post('/auth/resend-verification', { email })

/** Request password reset email */
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email })

/** Reset password using token */
export const resetPassword = (token, password) => api.post(`/auth/reset-password/${token}`, { password })
