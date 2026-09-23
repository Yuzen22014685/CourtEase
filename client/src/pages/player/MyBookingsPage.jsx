import { useState } from 'react'
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
  const { data, loading, error, refetch } = useApi(() => getMyBookings(), [])

  const bookings = data?.data ?? []
  const upcoming = bookings.filter(
    (b) => b.status !== 'cancelled' && isUpcoming(b.date, b.startTime)
  )
  const past = bookings.filter(
    (b) => b.status === 'cancelled' || !isUpcoming(b.date, b.startTime)
  )

  const displayed = activeTab === 'upcoming' ? upcoming : past

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
              <BookingCard key={booking._id} booking={booking} onCancelled={refetch} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

/* ── Booking Card ──────────────────────────────────────────────── */
function BookingCard({ booking, onCancelled }) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelSuccess, setCancelSuccess] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

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
    <div className="card p-5 animate-fadeIn">
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
              onClick={() => setUploadOpen(true)}
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

      <Modal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Proof of Payment"
        size="lg"
      >
        <UploadReceiptPanel 
          bookingIds={[booking._id]} 
          onSuccess={() => {
            setUploadOpen(false)
            onCancelled() // Parent passes refetch here
          }} 
        />
      </Modal>
    </div>
  )
}
