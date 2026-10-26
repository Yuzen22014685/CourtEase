import api from './axios'

/**
 * Send chat messages to CourtEase chatbot API
 * @param {Array<{ role: 'user' | 'assistant', text: string }>} messages
 */
export const sendChat = (messages) => api.post('/chat', { messages })
