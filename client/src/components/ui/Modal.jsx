import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'

// Stack of open modals, so Escape closes only the top one (e.g. a confirm dialog over the checkout).
const openModalStack = []

export default function Modal({ isOpen, onClose, title, children, size = 'md', disableBackdropClick = false }) {
  // Stable ref for onClose so the keydown effect never re-registers due to
  // a new function reference identity (which would cause stale closure capture
  // of old state mid-async-sequence in React 19 Strict Mode).
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Close on Escape — only the most recently opened modal reacts.
  useEffect(() => {
    if (!isOpen) return undefined
    const id = Symbol('modal')
    openModalStack.push(id)
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (openModalStack[openModalStack.length - 1] !== id) return
      onCloseRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      const i = openModalStack.indexOf(id)
      if (i !== -1) openModalStack.splice(i, 1)
    }
  }, [isOpen])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', '3xl': 'max-w-3xl' }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
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
          <button type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                             transition-colors"
                  aria-label="Close modal">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {/* Body */}
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  )
}

