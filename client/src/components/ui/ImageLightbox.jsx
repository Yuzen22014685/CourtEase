import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'

export default function ImageLightbox({ isOpen, onClose, src, alt = '', caption = '' }) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Close on Escape — captured in capture phase with stopPropagation
  // so that if this lightbox sits on top of another modal, only the lightbox closes.
  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen])

  // Prevent body scroll when open
  useEffect(() => {
    if (!isOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen || !src) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={caption || alt || 'Image lightbox'}
    >
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-fadeIn cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Close button (top right) */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Close"
      >
        <XMarkIcon className="h-7 w-7" />
      </button>

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col items-center max-w-5xl max-h-[92vh] w-full animate-fadeIn pointer-events-none">
        <div className="relative pointer-events-auto">
          <img
            src={src}
            alt={alt || caption || 'Event poster'}
            className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl mx-auto select-none"
          />
        </div>

        {caption && (
          <p className="mt-3 text-center text-sm sm:text-base font-medium text-white/90 drop-shadow px-4 max-w-2xl select-text pointer-events-auto">
            {caption}
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}

