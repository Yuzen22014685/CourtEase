import api from './axios'

export const getNotifications = () => api.get('/notifications').then(res => res.data)
export const getUnreadCount = () => api.get('/notifications/unread-count').then(res => res.data)
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`).then(res => res.data)
