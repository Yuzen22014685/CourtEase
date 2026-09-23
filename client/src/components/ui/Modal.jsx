import { useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

export default function Modal({ isOpen, onClose, title, children, size = 'md', disableBackdropClick = false }) {
  // Stable ref for onClose so the keydown effect never re-registers due to
  // a new function reference identity (which would cause stale closure capture
  // of old state mid-async-sequence in React 19 Strict Mode).
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Close on Escape key — depends only on isOpen, not on the onClose identity
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
         role="dialog" aria-modal="true" aria-labelledby="modal-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
           onClick={disableBackdropClick ? undefined : onClose} />
      {/* Panel */}
      <div className={`relative w-full ${widths[size]} max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-elevated
                       animate-slideUp overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 id="modal-title" className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                             transition-colors"
                  aria-label="Close modal">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {/* Body */}
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}
