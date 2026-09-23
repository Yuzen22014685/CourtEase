import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { getMyBookings, cancelBooking } from '../../api/bookings'
import Layout from '../../components/layout/Layout'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import SkeletonCard from '../../components/ui/SkeletonCard'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import UploadReceiptPanel from '../../components/bookings/UploadReceiptPanel'
import { formatCurrency, formatDate, formatTime, isUpcoming } from '../../utils/format'
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  BuildingOffice2Icon,
  XCircleIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState('upcoming')
  const [highlightedBookingId, setHighlightedBookingId] = useState(null)
  const [uploadModalBookingId, setUploadModalBookingId] = useState(null)
  const [infoToast, setInfoToast] = useState('')

  const [searchParams, setSearchParams] = useSearchParams()
  const uploadReceiptParam = searchParams.get('uploadReceipt')
  const highlightParam = searchParams.get('highlight')

  const { data, loading, error, refetch } = useApi(() => getMyBookings(), [])

  const bookings = useMemo(() => data?.data ?? [], [data])
  const upcoming = bookings.filter(
    (b) => b.status !== 'cancelled' && isUpcoming(b.date, b.startTime)
  )
  const past = bookings.filter(
    (b) => b.status === 'cancelled' || !isUpcoming(b.date, b.startTime)
  )

  useEffect(() => {
    if (loading) return
    if (!uploadReceiptParam && !highlightParam) return

    // Handle receipt upload deep link
    if (uploadReceiptParam) {
      const target = bookings.find((b) => b._id === uploadReceiptParam)
      if (target) {
        const isTargetUpcoming = target.status !== 'cancelled' && isUpcoming(target.date, target.startTime)
        setActiveTab(isTargetUpcoming ? 'upcoming' : 'past')

        if (target.receiptImage) {
          setInfoToast('Receipt already uploaded')
          setTimeout(() => setInfoToast(''), 3500)
        } else {
          setUploadModalBookingId(target._id)
        }
      }
    }

    // Handle booking highlight deep link
    if (highlightParam) {
      const target = bookings.find((b) => b._id === highlightParam)
      if (target) {
        const isTargetUpcoming = target.status !== 'cancelled' && isUpcoming(target.date, target.startTime)
        setActiveTab(isTargetUpcoming ? 'upcoming' : 'past')

        setHighlightedBookingId(target._id)
        setTimeout(() => {
          const el = document.getElementById(`booking-${target._id}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 150)
        setTimeout(() => {
          setHighlightedBookingId(null)
        }, 3000)
      }
    }

    // Remove params from URL (replace, not push) so refresh does not re-trigger
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('uploadReceipt')
        next.delete('highlight')
        return next
      },
      { replace: true }
    )
  }, [loading, bookings, uploadReceiptParam, highlightParam, setSearchParams])

  const displayed = activeTab === 'upcoming' ? upcoming : past
  const uploadTargetBooking = uploadModalBookingId
    ? bookings.find((b) => b._id === uploadModalBookingId)
    : null

  return (
    <Layout>
      <div className="page-container">
        <div className="mb-8">
          <h1 className="page-title mb-1">My Bookings</h1>
          <p className="text-sm text-gray-500">Manage and track your court reservations.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
          {[
            { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { key: 'past',     label: 'Past & Cancelled', count: past.length },
          ].map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab.label}
              {!loading && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full
                  ${activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-500'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <ErrorMessage message={error} className="mb-4" />

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={activeTab === 'upcoming' ? '📅' : '🕐'}
            title={activeTab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
            description={
              activeTab === 'upcoming'
                ? 'Book a court to see your reservations here.'
                : 'Your completed and cancelled bookings will appear here.'
            }
            action={
              activeTab === 'upcoming'
                ? <a href="/venues" className="btn-primary">Browse Venues</a>
                : null
            }
          />
        ) : (
          <div className="grid gap-4">
            {displayed.map((booking) => (
              <BookingCard
                key={booking._id}
                booking={booking}
                isHighlighted={highlightedBookingId === booking._id}
                onCancelled={refetch}
                onOpenUpload={setUploadModalBookingId}
              />
            ))}
          </div>
        )}

        {/* Page-level Upload Receipt Modal */}
        <Modal
          isOpen={Boolean(uploadModalBookingId)}
          onClose={() => setUploadModalBookingId(null)}
          title="Upload Proof of Payment"
          size="lg"
        >
          {uploadModalBookingId && (
            <>
              {uploadTargetBooking && (
                <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-3 text-sm space-y-2 mb-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900">
                      {uploadTargetBooking.venueId?.name ?? '—'} · Court {uploadTargetBooking.courtId?.courtNumber ?? '—'}
                    </span>
                    <span className="font-semibold text-primary-600 shrink-0">
                      {formatCurrency(uploadTargetBooking.amount)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-gray-600">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(uploadTargetBooking.date)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4 text-gray-400" />
                        <span>{formatTime(uploadTargetBooking.startTime)} – {formatTime(uploadTargetBooking.endTime)}</span>
                      </div>
                    </div>
                    {uploadTargetBooking.receiptId && (
                      <span className="text-xs text-gray-400">
                        Receipt: <span className="font-mono text-gray-600">{uploadTargetBooking.receiptId}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
              <UploadReceiptPanel 
                bookingIds={[uploadModalBookingId]} 
                onSuccess={() => {
                  setUploadModalBookingId(null)
                  refetch()
                }} 
              />
            </>
          )}
        </Modal>

        {/* Info Toast */}
        {infoToast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-gray-900/95 backdrop-blur text-white text-sm px-4 py-3 rounded-xl shadow-xl border border-gray-800 animate-fadeIn">
            <CheckCircleIcon className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{infoToast}</span>
          </div>
        )}
      </div>
    </Layout>
  )
}

/* ── Booking Card ──────────────────────────────────────────────── */
function BookingCard({ booking, isHighlighted, onCancelled, onOpenUpload }) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelSuccess, setCancelSuccess] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)

  const upcoming = booking.status !== 'cancelled' && isUpcoming(booking.date, booking.startTime)
  const venueName = booking.venueId?.name ?? '—'
  const courtNum  = booking.courtId?.courtNumber ?? '—'
  const isPendingWithoutReceipt = booking.status === 'pending' && !booking.receiptImage

  const executeCancel = async () => {
    setConfirmOpen(false)
    setCancelling(true)
    setCancelError('')
    try {
      await cancelBooking(booking._id)
      setCancelSuccess(true)
      setTimeout(() => {
        setCancelSuccess(false)
        onCancelled()
      }, 2000)
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Failed to cancel booking.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div
      id={`booking-${booking._id}`}
      className={`card p-5 animate-fadeIn transition-all duration-500 ${
        isHighlighted ? 'ring-2 ring-emerald-500 ring-offset-2 shadow-lg' : ''
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Left: info */}
        <div className="flex-1 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <BuildingOffice2Icon className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{venueName}</h3>
              <p className="text-sm text-gray-500">Court {courtNum}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1.5 text-gray-600">
              <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
              {formatDate(booking.date)}
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <MapPinIcon className="h-4 w-4 text-gray-400" />
              {booking.venueId?.area ?? '—'}
            </div>
            <div className="font-semibold text-primary-600">
              {formatCurrency(booking.amount)}
            </div>
          </div>
        </div>

        {/* Right: status + action */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <Badge status={booking.status} />

          {upcoming && !cancelSuccess && (
            <button
              id={`cancel-booking-${booking._id}`}
              onClick={() => setConfirmOpen(true)}
              disabled={cancelling}
              className="btn-danger btn-sm flex items-center gap-1.5"
            >
              {cancelling
                ? <Spinner size="sm" />
                : <XCircleIcon className="h-4 w-4" />}
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}

          {isPendingWithoutReceipt && (
            <button
              onClick={() => onOpenUpload(booking._id)}
              className="btn-primary btn-sm flex items-center gap-1.5"
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              Upload Receipt
            </button>
          )}

          {booking.status === 'pending' && booking.receiptImage && (
            <div className="flex items-center gap-1.5 text-primary-600 text-sm font-medium">
              <CheckCircleIcon className="h-4 w-4" />
              Receipt uploaded
            </div>
          )}

          {cancelSuccess && (
            <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
              <CheckCircleIcon className="h-4 w-4" />
              Cancelled
            </div>
          )}
        </div>
      </div>

      {/* Cancel error — shown verbatim as required */}
      {cancelError && (
        <div className="mt-4">
          <ErrorMessage message={cancelError} />
        </div>
      )}

      {/* Receipt ID */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">Receipt: <span className="font-mono">{booking.receiptId}</span></span>
        <Badge status={booking.paymentStatus} />
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking?"
        confirmText="Yes, Cancel"
        cancelText="No, Keep It"
        confirmVariant="danger"
        onConfirm={executeCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
