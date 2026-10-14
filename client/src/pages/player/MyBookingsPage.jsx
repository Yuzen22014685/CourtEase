import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { getMyBookings, cancelBooking, rescheduleBooking, submitReview } from '../../api/bookings'
import { getVenueAvailability } from '../../api/venues'
import Layout from '../../components/layout/Layout'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import SkeletonCard from '../../components/ui/SkeletonCard'
import Modal from '../../components/ui/Modal'
import UploadReceiptPanel from '../../components/bookings/UploadReceiptPanel'
import PayVenueCard from '../../components/bookings/PayVenueCard'
import OrderCard, { getPlayerPaymentBadge } from '../../components/bookings/OrderCard'
import { formatCurrency, formatDate, formatTime, isUpcoming, formatPaymentRef, formatPaymentMethod } from '../../utils/format'
import clsx from 'clsx'
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  BuildingOffice2Icon,
  XCircleIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { StarIcon as StarOutline } from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANGE_CUTOFF_HOURS = 24 // mirrors config/bookingPolicy.js — for client-side slot filtering only

const isBookingUpcoming = (b) =>
  Boolean(b && ['pending', 'confirmed'].includes(b.status) && isUpcoming(b.date, b.startTime))

/** Parse "HH:MM" into total minutes */
const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Compute today's date as YYYY-MM-DD in Malaysia time (UTC+8) */
const todayMY = () => {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
}

/**
 * Group bookings by paymentRef while preserving earliest-booking order.
 * Bookings without paymentRef remain single items.
 */
function groupBookingsByPaymentRef(bookingList) {
  const result = []
  const seenPaymentRefs = new Set()

  for (const booking of bookingList) {
    if (booking.paymentRef) {
      if (seenPaymentRefs.has(booking.paymentRef)) {
        continue
      }
      seenPaymentRefs.add(booking.paymentRef)
      const groupBookings = bookingList.filter(
        (b) => b.paymentRef === booking.paymentRef
      )
      result.push({
        type: 'order',
        key: `order-${booking.paymentRef}`,
        paymentRef: booking.paymentRef,
        bookings: groupBookings,
      })
    } else {
      result.push({
        type: 'single',
        key: `single-${booking._id}`,
        booking,
      })
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState('upcoming')
  const [highlightedBookingId, setHighlightedBookingId] = useState(null)
  const [uploadModalBookingId, setUploadModalBookingId] = useState(null)
  const [rescheduleModalBookingId, setRescheduleModalBookingId] = useState(null)
  const [reviewModalBookingId, setReviewModalBookingId] = useState(null)
  const [cancelModalBookingId, setCancelModalBookingId] = useState(null)
  const [infoToast, setInfoToast] = useState('')

  const [searchParams, setSearchParams] = useSearchParams()
  const uploadReceiptParam = searchParams.get('uploadReceipt')
  const highlightParam = searchParams.get('highlight')
  const reviewParam = searchParams.get('review')

  const { data, loading, error, refetch } = useApi(() => getMyBookings(), [])

  const bookings = useMemo(() => data?.data ?? [], [data])
  const upcoming = bookings.filter(isBookingUpcoming)
  const past = bookings.filter((b) => !isBookingUpcoming(b))

  const toReviewCount = useMemo(
    () => past.filter((b) => b.canReview).length,
    [past]
  )

  const sortedPast = useMemo(() => {
    const toReview = []
    const others = []
    for (const b of past) {
      if (b.canReview) {
        toReview.push(b)
      } else {
        others.push(b)
      }
    }
    return [...toReview, ...others]
  }, [past])

  const highlightBooking = useCallback((id) => {
    setHighlightedBookingId(id)
    setTimeout(() => {
      const el = document.getElementById(`booking-${id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    setTimeout(() => setHighlightedBookingId(null), 3000)
  }, [])

  useEffect(() => {
    if (loading) return
    if (!uploadReceiptParam && !highlightParam && !reviewParam) return

    if (uploadReceiptParam) {
      const target = bookings.find((b) => b._id === uploadReceiptParam)
      if (target) {
        const isTargetUpcoming = isBookingUpcoming(target)
        setActiveTab(isTargetUpcoming ? 'upcoming' : 'past')
        if (['rejected', 'cancelled', 'expired'].includes(target.status)) {
          setInfoToast('Cannot upload a receipt for a rejected, cancelled, or expired booking')
          setTimeout(() => setInfoToast(''), 3500)
        } else if (target.receiptImage) {
          setInfoToast('Receipt already uploaded')
          setTimeout(() => setInfoToast(''), 3500)
        } else {
          setUploadModalBookingId(target._id)
        }
      }
    }

    if (highlightParam) {
      const target = bookings.find((b) => b._id === highlightParam)
      if (target) {
        const isTargetUpcoming = isBookingUpcoming(target)
        setActiveTab(isTargetUpcoming ? 'upcoming' : 'past')
        highlightBooking(target._id)
      }
    }

    if (reviewParam) {
      const target = bookings.find((b) => b._id === reviewParam)
      if (target) {
        setActiveTab('past') // completed bookings are always in past tab
        if (target.myReview) {
          setInfoToast('You have already reviewed this booking')
          setTimeout(() => setInfoToast(''), 3500)
        } else if (!target.canReview) {
          setInfoToast("This booking can't be reviewed")
          setTimeout(() => setInfoToast(''), 3500)
        } else {
          setReviewModalBookingId(target._id)
        }
      }
    }

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('uploadReceipt')
        next.delete('highlight')
        next.delete('review')
        return next
      },
      { replace: true }
    )
  }, [loading, bookings, uploadReceiptParam, highlightParam, reviewParam, setSearchParams, highlightBooking])

  const displayed = activeTab === 'upcoming' ? upcoming : sortedPast
  const groupedDisplayed = useMemo(
    () => groupBookingsByPaymentRef(displayed),
    [displayed]
  )
  const uploadTargetBooking = uploadModalBookingId
    ? bookings.find((b) => b._id === uploadModalBookingId)
    : null

  const uploadBookingIds = useMemo(() => {
    if (!uploadTargetBooking) return []
    if (uploadTargetBooking.status === 'pending' && uploadTargetBooking.paymentRef) {
      const matching = bookings
        .filter((b) => b.status === 'pending' && b.paymentRef === uploadTargetBooking.paymentRef)
        .map((b) => b._id)
      return matching.length > 0 ? matching : [uploadTargetBooking._id]
    }
    return [uploadTargetBooking._id]
  }, [uploadTargetBooking, bookings])
  const rescheduleTargetBooking = rescheduleModalBookingId
    ? bookings.find((b) => b._id === rescheduleModalBookingId)
    : null
  const reviewTargetBooking = reviewModalBookingId
    ? bookings.find((b) => b._id === reviewModalBookingId)
    : null
  const cancelTargetBooking = cancelModalBookingId
    ? bookings.find((b) => b._id === cancelModalBookingId)
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
            { key: 'past',     label: 'Past & Cancelled', count: past.length, reviewCount: toReviewCount },
          ].map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center
                ${activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <span>{tab.label}</span>
              {!loading && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full
                  ${activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-500'}`}>
                  {tab.count}
                </span>
              )}
              {!loading && tab.reviewCount > 0 && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">
                  {tab.reviewCount} to review
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
            {groupedDisplayed.map((item) =>
              item.type === 'order' ? (
                <OrderCard
                  key={item.key}
                  order={item}
                  highlightedBookingId={highlightedBookingId}
                  onOpenUpload={setUploadModalBookingId}
                  onOpenCancel={setCancelModalBookingId}
                  onOpenReview={setReviewModalBookingId}
                />
              ) : (
                <BookingCard
                  key={item.key}
                  booking={item.booking}
                  isHighlighted={highlightedBookingId === item.booking._id}
                  onOpenUpload={setUploadModalBookingId}
                  onOpenCancel={setCancelModalBookingId}
                  onOpenReview={setReviewModalBookingId}
                />
              )
            )}
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
            <div className="space-y-4">
              {uploadTargetBooking?.status === 'pending' ? (
                <PayVenueCard
                  bookingId={uploadTargetBooking._id}
                  chosenMethod={uploadTargetBooking.paymentMethod}
                />
              ) : (
                uploadTargetBooking && (
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
                )
              )}

              {uploadBookingIds.length > 1 && (
                <div className="p-3 bg-primary-50/70 border border-primary-200 rounded-xl text-xs text-primary-800 font-medium">
                  This receipt will be attached to {uploadBookingIds.length} bookings paid together.
                </div>
              )}

              <UploadReceiptPanel
                bookingIds={uploadBookingIds}
                onSuccess={() => {
                  setUploadModalBookingId(null)
                  refetch()
                }}
              />
            </div>
          )}
        </Modal>

        {/* Page-level Reschedule Modal */}
        <Modal
          isOpen={Boolean(rescheduleModalBookingId)}
          onClose={() => setRescheduleModalBookingId(null)}
          title="Reschedule Booking"
          size="xl"
        >
          {rescheduleTargetBooking && (
            <RescheduleModal
              booking={rescheduleTargetBooking}
              onClose={() => setRescheduleModalBookingId(null)}
              onSuccess={(bookingId) => {
                setRescheduleModalBookingId(null)
                refetch()
                // Switch to upcoming tab and highlight
                setActiveTab('upcoming')
                setTimeout(() => highlightBooking(bookingId), 300)
              }}
            />
          )}
        </Modal>

        {/* Page-level Review Modal */}
        <Modal
          isOpen={Boolean(reviewModalBookingId)}
          onClose={() => setReviewModalBookingId(null)}
          title="Rate & Review"
          size="lg"
        >
          {reviewTargetBooking && (
            <ReviewModal
              booking={reviewTargetBooking}
              onClose={() => setReviewModalBookingId(null)}
              onSuccess={() => {
                setReviewModalBookingId(null)
                refetch()
              }}
            />
          )}
        </Modal>

        {/* Page-level Cancel Options Modal */}
        {cancelTargetBooking && (
          <CancelOptionsModal
            booking={cancelTargetBooking}
            isOpen={Boolean(cancelModalBookingId)}
            onClose={() => setCancelModalBookingId(null)}
            onOpenReschedule={(bookingId) => {
              setCancelModalBookingId(null)
              setRescheduleModalBookingId(bookingId)
            }}
            onSuccess={() => {
              setCancelModalBookingId(null)
              setInfoToast('Booking cancelled')
              setTimeout(() => setInfoToast(''), 3500)
              refetch()
            }}
          />
        )}

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

// ---------------------------------------------------------------------------
// Booking Card
// ---------------------------------------------------------------------------
function BookingCard({ booking, isHighlighted, onOpenUpload, onOpenCancel, onOpenReview }) {
  // canCancel and canReschedule are server-computed and returned by GET /api/bookings/me
  const canCancel     = booking.canCancel
  const canReschedule = booking.canReschedule
  const canReview     = booking.canReview
  const myReview      = booking.myReview
  const venueName = booking.venueId?.name ?? '—'
  const courtNum  = booking.courtId?.courtNumber ?? '—'
  const isPendingWithoutReceipt = booking.status === 'pending' && !booking.receiptImage
  const paymentBadge = getPlayerPaymentBadge([booking])

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

          {/* Rescheduled-from annotation */}
          {booking.rescheduleCount > 0 && booking.rescheduledFrom && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <ArrowPathIcon className="h-3 w-3 shrink-0" />
              Rescheduled from{' '}
              {formatDate(booking.rescheduledFrom.date)},{' '}
              {formatTime(booking.rescheduledFrom.startTime)}
            </p>
          )}
        </div>

        {/* Right: status + actions */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <Badge status={booking.status} />

          {booking.status === 'rejected' && booking.rejectionReason && (
            <p className="text-xs text-gray-500 text-right max-w-[220px] leading-tight">
              Reason: {booking.rejectionReason}
            </p>
          )}

          {/* Action buttons row: single Cancel button when canCancel || canReschedule */}
          {(canCancel || canReschedule) && (
            <button
              id={`cancel-booking-${booking._id}`}
              onClick={() => onOpenCancel(booking._id)}
              className="btn-danger btn-sm flex items-center gap-1.5"
            >
              <XCircleIcon className="h-4 w-4" />
              Cancel
            </button>
          )}

          {/* Review: show button if canReview, show stars if already reviewed */}
          {canReview && (
            <button
              id={`review-booking-${booking._id}`}
              onClick={() => onOpenReview(booking._id)}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              <StarSolid className="h-4 w-4 text-amber-400" />
              Rate &amp; Review
            </button>
          )}
          {myReview && (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map((s) => (
                  s <= myReview.rating
                    ? <StarSolid key={s} className="h-4 w-4 text-amber-400" />
                    : <StarOutline key={s} className="h-4 w-4 text-amber-300" />
                ))}
                <span className="text-xs text-gray-500 ml-1">Your rating</span>
              </div>
              {myReview.isHidden && (
                <span className="text-xs text-gray-400">
                  Hidden by admin — {myReview.hiddenReason || 'Review hidden'}
                </span>
              )}
            </div>
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
        </div>
      </div>

      {/* Add-ons */}
      {booking.items && booking.items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700">Add-ons</span>
            <span className="text-[11px] text-gray-400">Collect at the venue</span>
          </div>

          <div className="bg-gray-50 rounded-lg p-2.5 space-y-1.5 border border-gray-100">
            {booking.items.map((item, idx) => (
              <div key={idx} className="text-xs space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-gray-800">
                      {item.quantity} × {item.name}
                    </span>
                    {item.category === 'service' && item.readyInfo && (
                      <span className="inline-flex items-center text-[10px] font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded px-1.5 py-0.5">
                        Ready in {item.readyInfo.replace(/^ready\s*(in)?\s*/i, '')}
                      </span>
                    )}
                  </div>
                  {item.unitPrice !== undefined && (
                    <span className="text-gray-500 font-medium shrink-0">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  )}
                </div>
                {item.note && (
                  <p className="text-[11px] text-gray-500 italic pl-2">
                    {item.note}
                  </p>
                )}
              </div>
            ))}

            <div className="flex justify-between items-center pt-1.5 border-t border-gray-200/60 text-xs">
              <span className="text-gray-500">Add-ons subtotal</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(
                  booking.itemsTotal ??
                    booking.items.reduce(
                      (sum, it) => sum + (it.unitPrice || 0) * (it.quantity || 1),
                      0
                    )
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Payment Reference & Status */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-gray-500">
          <span>Ref <span className="font-mono font-medium text-gray-700">{formatPaymentRef(booking)}</span></span>
          <span className="text-gray-300">·</span>
          <span className="font-medium text-gray-700">{formatPaymentMethod(booking.paymentMethod)}</span>
        </div>
        <Badge
          status={paymentBadge ? paymentBadge.status : booking.paymentStatus}
          label={
            paymentBadge
              ? paymentBadge.label
              : booking.paymentStatus === 'pending'
              ? 'Awaiting payment'
              : undefined
          }
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cancel Options Modal
// ---------------------------------------------------------------------------
function CancelOptionsModal({ booking, isOpen, onClose, onOpenReschedule, onSuccess }) {
  const [step, setStep] = useState(1)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setCancelling(false)
      setError('')
    }
  }, [isOpen])

  if (!booking) return null

  const handleConfirmCancellation = async () => {
    setCancelling(true)
    setError('')
    try {
      await cancelBooking(booking._id)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel booking.')
    } finally {
      setCancelling(false)
    }
  }

  const handleRescheduleClick = () => {
    onClose()
    onOpenReschedule(booking._id)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel booking?" size="md">
      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            CourtEase bookings are non-refundable. You can reschedule instead.
          </p>

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <button
                type="button"
                id="cancel-modal-reschedule-btn"
                disabled={!booking.canReschedule}
                onClick={handleRescheduleClick}
                className="btn-primary w-full flex items-center justify-center gap-1.5"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Reschedule
              </button>
              {!booking.canReschedule && booking.rescheduleBlockedReason && (
                <p className="text-xs text-gray-500 text-center">
                  {booking.rescheduleBlockedReason}
                </p>
              )}
            </div>

            <button
              type="button"
              id="cancel-modal-keep-btn"
              onClick={onClose}
              className="btn-secondary w-full flex items-center justify-center"
            >
              Keep booking
            </button>

            {booking.canCancel && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  id="cancel-modal-cancel-link"
                  onClick={() => {
                    setError('')
                    setStep(2)
                  }}
                  className="text-xs text-red-600 hover:text-red-700 underline font-medium cursor-pointer"
                >
                  Cancel anyway (no refund)
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You will not receive a refund. Cancel this booking?
          </p>

          {error && <ErrorMessage message={error} />}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              id="cancel-modal-back-btn"
              disabled={cancelling}
              onClick={() => {
                setError('')
                setStep(1)
              }}
              className="btn-secondary flex-1"
            >
              No, go back
            </button>
            <button
              type="button"
              id="cancel-modal-confirm-btn"
              disabled={cancelling}
              onClick={handleConfirmCancellation}
              className="btn-danger flex-1 flex items-center justify-center gap-1.5"
            >
              {cancelling && <Spinner size="sm" />}
              {cancelling ? 'Cancelling…' : 'Confirm cancellation'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Reschedule Modal
// ---------------------------------------------------------------------------
function RescheduleModal({ booking, onClose, onSuccess }) {
  const venueId     = booking.venueId?._id ?? booking.venueId
  const venueName   = booking.venueId?.name ?? '—'
  const durationMins = toMinutes(booking.endTime) - toMinutes(booking.startTime)

  /**
   * Compute the earliest date on which a slot can exist:
   * now + CHANGE_CUTOFF_HOURS (24h), expressed as a calendar date in Malaysia time (UTC+8).
   * This may be today (e.g. at 03:00 MY, earliest eligible slot is 03:00 tomorrow → same MY date)
   * or tomorrow (e.g. at 23:00 MY, earliest is 23:00 + 24h = 23:00 the day after tomorrow).
   */
  const earliestDateMY = useMemo(() => {
    const cutoff = new Date(Date.now() + CHANGE_CUTOFF_HOURS * 60 * 60 * 1000)
    return cutoff.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
  }, []) // computed once on mount

  const [selectedDate, setSelectedDate] = useState(earliestDateMY)
  // Track whether the current date was set automatically (so we can auto-advance once if needed)
  const [dateIsAuto, setDateIsAuto] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null) // { courtId, start, end }
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState('')

  // Fetch availability whenever the date changes
  const fetchAvail = useCallback(
    () => getVenueAvailability(venueId, selectedDate),
    [venueId, selectedDate]
  )
  const { data: availData, loading: availLoading, error: availError } = useApi(fetchAvail, [selectedDate])

  // Reset selected slot when date changes
  useEffect(() => { setSelectedSlot(null) }, [selectedDate])

  /**
   * Filter available slots for the reschedule modal.
   * For each court, a slot is eligible iff:
   *   1. The slot is marked available in the matrix (no other blocking booking).
   *   2. The slot's start is > CHANGE_CUTOFF_HOURS from now (cannot move into no-change window).
   *   3. The court has consecutive available slots to cover the full booking duration.
   *      For a 1-hour booking (60 min → 1 slot), just that slot.
   *      For a 2-hour booking (120 min → 2 consecutive slots), both must be free.
   *
   * We return a flat list of { courtId, courtNumber, start, end }
   * where `end` is start + durationMins.
   */
  const { eligibleSlots, hasHigherPriceSlots } = useMemo(() => {
    const matrix = availData?.matrix ?? []
    const now = new Date()
    const result = []
    let priceFiltered = false

    for (const court of matrix) {
      const slots = court.slots // [{ start, end, available, price }]
      const slotCount = durationMins / 60 // number of consecutive 1-hour slots needed

      for (let i = 0; i <= slots.length - slotCount; i++) {
        // Check that all required consecutive slots are available
        const window = slots.slice(i, i + slotCount)
        if (window.length < slotCount) continue
        if (!window.every((s) => s.available)) continue

        const blockStart = window[0].start
        const blockEnd   = window[window.length - 1].end

        // Must be > 24h from now (Malaysia UTC+8)
        const slotStartDate = new Date(`${selectedDate}T${blockStart}:00+08:00`)
        const hoursUntil = (slotStartDate - now) / (1000 * 60 * 60)
        if (hoursUntil <= CHANGE_CUTOFF_HOURS) continue

        // Skip if it's the same slot as the current booking (no-op reschedule)
        if (
          selectedDate === booking.date &&
          blockStart === booking.startTime &&
          court.courtId.toString() === (booking.courtId?._id ?? booking.courtId).toString()
        ) continue

        // Price check: window price must not exceed booking.amount + 0.005
        const windowPrice = window.reduce((sum, s) => sum + (s.price ?? 0), 0)
        if (windowPrice > (booking.amount ?? 0) + 0.005) {
          priceFiltered = true
          continue
        }

        result.push({
          courtId:      court.courtId,
          courtNumber:  court.courtNumber,
          start:        blockStart,
          end:          blockEnd,
        })
      }
    }

    return { eligibleSlots: result, hasHigherPriceSlots: priceFiltered }
  }, [availData, selectedDate, durationMins, booking])

  // If the auto-computed initial date has no eligible slots, silently advance to the next day.
  // This only fires once (dateIsAuto guard) so manual user selections are never overridden.
  useEffect(() => {
    if (!dateIsAuto) return          // user has already chosen a date manually
    if (availLoading) return         // wait until the fetch completes
    if (eligibleSlots.length > 0) { // slots exist — no need to advance
      setDateIsAuto(false)           // lock: stop auto-advancing
      return
    }
    // No eligible slots on the auto date → try the next calendar day
    const next = new Date(`${selectedDate}T00:00:00+08:00`)
    next.setDate(next.getDate() + 1)
    const nextStr = next.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
    setSelectedDate(nextStr)
    setDateIsAuto(false) // advance only once
  }, [availLoading, eligibleSlots, selectedDate, dateIsAuto])

  const handleConfirm = async () => {
    if (!selectedSlot) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await rescheduleBooking(booking._id, {
        date:      selectedDate,
        startTime: selectedSlot.start,
        courtId:   selectedSlot.courtId,
      })
      onSuccess(res.data._id ?? booking._id)
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to reschedule. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // The date picker's min = the earliest date where a slot could exist (now + 24h in MY time)
  const minDate = earliestDateMY

  return (
    <div className="space-y-5">
      {/* Current booking summary */}
      <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4 text-sm space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Current Booking</p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-gray-900">
            {venueName} · Court {booking.courtId?.courtNumber ?? '—'}
          </span>
          <span className="font-semibold text-primary-600 shrink-0">
            {formatCurrency(booking.amount)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-gray-600">
          <div className="flex items-center gap-1.5">
            <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
            {formatDate(booking.date)}
          </div>
          <div className="flex items-center gap-1.5">
            <ClockIcon className="h-4 w-4 text-gray-400" />
            {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
            <span className="text-xs text-gray-400">({durationMins / 60}h)</span>
          </div>
        </div>
      </div>

      {/* Date picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Choose a new date
        </label>
        <input
          type="date"
          value={selectedDate}
          min={minDate}
          onChange={(e) => {
            setSelectedDate(e.target.value)
            setDateIsAuto(false) // user has taken control; disable auto-advance
          }}
          className="input w-full sm:w-auto"
          id="reschedule-date-picker"
        />
      </div>

      {/* Available slots */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Available slots on {formatDate(selectedDate)}
          <span className="ml-1.5 text-xs text-gray-400 font-normal">(same duration · more than 24 h away)</span>
        </p>
        {hasHigherPriceSlots && (
          <p className="text-xs text-gray-500 mb-2">
            Only times at the same or lower price are shown.
          </p>
        )}

        {availLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Spinner size="sm" /> Loading availability…
          </div>
        ) : availError ? (
          <ErrorMessage message="Could not load availability. Please try a different date." />
        ) : eligibleSlots.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
            No eligible slots on this date. Try another day.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
            {eligibleSlots.map((slot) => {
              const key = `${slot.courtId}::${slot.start}`
              const isSelected =
                selectedSlot &&
                selectedSlot.courtId.toString() === slot.courtId.toString() &&
                selectedSlot.start === slot.start

              return (
                <button
                  key={key}
                  onClick={() => setSelectedSlot(isSelected ? null : slot)}
                  className={clsx(
                    'rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 border',
                    isSelected
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm scale-105'
                      : 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100 hover:border-primary-400 cursor-pointer'
                  )}
                  aria-label={`Court ${slot.courtNumber}, ${slot.start}–${slot.end}`}
                >
                  <span className="block font-semibold">{formatTime(slot.start)} – {formatTime(slot.end)}</span>
                  <span className="block text-[10px] opacity-75">Court {slot.courtNumber}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Error from API */}
      {submitError && <ErrorMessage message={submitError} />}

      {/* Selected slot preview */}
      {selectedSlot && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-primary-50 rounded-lg border border-primary-200 text-sm text-primary-800">
          <CheckCircleIcon className="h-4 w-4 text-primary-600 shrink-0" />
          <span>
            Moving to <strong>{formatDate(selectedDate)}</strong> at{' '}
            <strong>{formatTime(selectedSlot.start)} – {formatTime(selectedSlot.end)}</strong>
            {' '}· Court {eligibleSlots.find(
              (s) => s.courtId.toString() === selectedSlot.courtId.toString() && s.start === selectedSlot.start
            )?.courtNumber}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1" disabled={submitting}>
          Cancel
        </button>
        <button
          id="confirm-reschedule-btn"
          onClick={handleConfirm}
          disabled={!selectedSlot || submitting}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Spinner size="sm" /> Rescheduling…</>
          ) : (
            <><ArrowPathIcon className="h-4 w-4" /> Confirm Reschedule</>
          )}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Review Modal
// ---------------------------------------------------------------------------
function ReviewModal({ booking, onClose, onSuccess }) {
  const [rating, setRating]     = useState(0)
  const [hovered, setHovered]   = useState(0)
  const [comment, setComment]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  const venueName = booking.venueId?.name ?? '—'
  const courtNum  = booking.courtId?.courtNumber ?? '—'
  const remaining = 500 - comment.length

  const handleSubmit = async () => {
    if (!rating) return
    setSubmitting(true)
    setError('')
    try {
      await submitReview(booking._id, { rating, comment: comment.trim() })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Booking summary */}
      <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4 text-sm space-y-1.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your session</p>
        <p className="font-semibold text-gray-900">{venueName} · Court {courtNum}</p>
        <div className="flex flex-wrap gap-4 text-gray-600 text-xs">
          <span className="flex items-center gap-1">
            <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
            {formatDate(booking.date)}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon className="h-4 w-4 text-gray-400" />
            {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
          </span>
        </div>
      </div>

      {/* Star picker */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Your rating <span className="text-red-500">*</span></p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= (hovered || rating)
            return (
              <button
                key={star}
                id={`review-star-${star}`}
                type="button"
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110 focus:outline-none"
                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              >
                {filled
                  ? <StarSolid className="h-8 w-8 text-amber-400" />
                  : <StarOutline className="h-8 w-8 text-amber-300" />}
              </button>
            )
          })}
          {rating > 0 && (
            <span className="ml-2 text-sm font-semibold text-gray-700">
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </span>
          )}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label htmlFor="review-comment" className="block text-sm font-medium text-gray-700 mb-1.5">
          Comment <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          rows={4}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience at this venue…"
          className="input w-full resize-none"
        />
        <p className={`text-xs mt-1 text-right ${remaining < 50 ? 'text-amber-600' : 'text-gray-400'}`}>
          {remaining} characters remaining
        </p>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1" disabled={submitting}>
          Cancel
        </button>
        <button
          id="submit-review-btn"
          onClick={handleSubmit}
          disabled={!rating || submitting}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Spinner size="sm" /> Submitting…</>
          ) : (
            <><StarSolid className="h-4 w-4" /> Submit Review</>
          )}
        </button>
      </div>
    </div>
  )
}
