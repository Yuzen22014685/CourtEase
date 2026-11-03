import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { sendChat } from '../../api/chat'

// Light clean-up of Markdown the model may return; output stays plain text (no HTML).
const formatReply = (text) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '• ')

const SUGGESTIONS = [
  'Which venues are cheapest?',
  'Any free courts tomorrow evening?',
  'How do cancellations work?',
]

export default function ChatWidget() {
  const location = useLocation()
  const [isOpen, setIsOpen]     = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)

  const messagesEndRef = useRef(null)
  const textareaRef    = useRef(null)

  // Venue detail route in AppRouter is /venues/:id (e.g. /venues/66123456789)
  const isVenueDetailPage = /^\/venues\/[^/]+$/.test(location.pathname)

  // Raise button only on small screens below lg to avoid the mobile cart checkout bar
  const buttonPositionClass = isVenueDetailPage
    ? 'bottom-36 right-4 sm:bottom-20 lg:bottom-6 lg:right-6'
    : 'bottom-20 right-4 sm:bottom-6 sm:right-6'

  // Close panel on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Auto-scroll to newest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, isOpen])

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset conversation in state
  const handleNewChat = () => {
    if (loading) return
    setMessages([])
    setInput('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // Send message
  const handleSend = async (textToSend) => {
    const raw = typeof textToSend === 'string' ? textToSend : input
    const trimmed = raw.trim()
    if (!trimmed || loading) return

    const userMsg = { id: `u-${Date.now()}`, role: 'user', text: trimmed }

    // History: previous valid turns (exclude welcome and error bubbles) + new user message, max 12
    const cleanHistory = messages
      .filter((m) => !m.isError && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role, text: m.text }))

    const historyToSend = [...cleanHistory, { role: 'user', text: trimmed }].slice(-12)

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await sendChat(historyToSend)
      const reply = res.data?.reply || ''
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: reply },
      ])
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        'Something went wrong. Please try again.'
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', text: errMsg, isError: true },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* ── Floating Round Button (hidden while panel is open) ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open CourtEase Assistant"
          className={`fixed ${buttonPositionClass} z-40 w-14 h-14 rounded-full bg-primary-600 text-white shadow-elevated hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
        >
          <ChatBubbleLeftRightIcon className="h-7 w-7" />
        </button>
      )}

      {/* ── Chat Panel (z-50 above navbar & mobile cart bar) ── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="CourtEase Assistant"
          className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[560px] z-50 bg-white sm:rounded-2xl sm:shadow-2xl sm:border sm:border-gray-200 flex flex-col overflow-hidden animate-fadeIn"
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-500" />
                <h2 className="text-sm font-semibold text-gray-900">CourtEase Assistant</h2>
              </div>
              <p className="text-[11px] text-gray-500">AI assistant · answers may contain mistakes</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewChat}
                disabled={loading}
                className="text-xs font-medium text-gray-500 hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-1.5 py-1 rounded"
              >
                New chat
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close CourtEase Assistant"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 bg-gray-50/50">
            {/* Welcome Bubble (local only, never sent to API) */}
            <div className="flex items-start gap-2">
              <div className="bg-gray-100 text-gray-800 text-sm rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%] min-w-0">
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                  Hi! Ask me about venues, prices, opening hours, court availability or how booking works.
                </p>

                {/* Suggestion Chips */}
                <div className="mt-3 flex flex-col gap-1.5">
                  {SUGGESTIONS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      disabled={loading}
                      onClick={() => handleSend(chip)}
                      className="text-left text-xs bg-white text-primary-700 hover:bg-primary-50 border border-primary-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Conversation Messages */}
            {messages.map((msg) => {
              const isUser = msg.role === 'user'

              if (msg.isError) {
                return (
                  <div key={msg.id} className="flex items-start gap-2">
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm max-w-[85%] min-w-0">
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.text}</p>
                    </div>
                  </div>
                )
              }

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="bg-primary-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm max-w-[85%] min-w-0">
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.text}</p>
                    </div>
                  </div>
                )
              }

              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="bg-gray-100 text-gray-800 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm max-w-[85%] min-w-0">
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{formatReply(msg.text)}</p>
                  </div>
                </div>
              )
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex items-start gap-2">
                <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input & Footer */}
          <div className="bg-white border-t border-gray-100 p-3 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="relative flex items-end gap-2"
            >
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  rows={1}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 pr-14 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent max-h-24"
                />
                {input.length >= 450 && (
                  <span className="absolute bottom-2 right-2 text-[10px] text-gray-400 pointer-events-none">
                    {input.length}/500
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="h-9 w-9 shrink-0 rounded-xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </form>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              Don't share personal information. Chats are not saved.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
