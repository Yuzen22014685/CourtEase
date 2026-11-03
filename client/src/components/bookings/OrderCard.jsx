import Badge from '../ui/Badge'
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatPaymentRef,
  formatPaymentMethod,
} from '../../utils/format'
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  BuildingOffice2Icon,
  XCircleIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  StarIcon as StarOutline,
  PhoneIcon,
  EnvelopeIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { Link } from 'react-router-dom'
import { SUPPORT_EMAIL } from '../../content/legal'

const TERMINAL_STATUSES = ['cancelled', 'rejected', 'expired']

// Compute player-facing payment badge wording using only non-terminal bookings
export function getPlayerPaymentBadge(bookings) {
  const activeBookings = (bookings || []).filter(
    (b) => b && !TERMINAL_STATUSES.includes(b.status)
  )

  if (activeBookings.length === 0) {
    return null
  }

  if (activeBookings.some((b) => b.status === 'pending' && b.receiptRequest && !b.receiptImage)) {
    return { status: 'pending', label: 'New receipt needed' }
  }

  // Any paymentStatus 'pending' → "Awaiting payment" (as now)
  if (activeBookings.some((b) => b.paymentStatus === 'pending')) {
    return { status: 'pending', label: 'Awaiting payment' }
  }

  // All 'paid' but at least one booking still status 'pending' → "Receipt submitted"
  if (
    activeBookings.every((b) => b.paymentStatus === 'paid') &&
    activeBookings.some((b) => b.status === 'pending')
  ) {
    return { status: 'pending', label: 'Receipt submitted' }
  }

  // All 'paid' and all bookings confirmed or completed → "Paid"
  if (
    activeBookings.every((b) => b.paymentStatus === 'paid') &&
    activeBookings.every((b) => b.status === 'confirmed' || b.status === 'completed')
  ) {
    return { status: 'paid', label: 'Paid' }
  }

  // Otherwise keep current behaviour
  const fallbackStatus = activeBookings[0].paymentStatus
  return {
    status: fallbackStatus,
    label: fallbackStatus === 'pending' ? 'Awaiting payment' : undefined,
  }
}

export default function OrderCard({
  order,
  highlightedBookingId,
  onOpenUpload,
  onOpenCancel,
  onOpenReview,
}) {
  const { bookings = [] } = order
  if (bookings.length === 0) return null

  // Sort booking rows inside an order by date, then startTime (ascending) before rendering
  const sortedBookings = [...bookings].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || '').localeCompare(b.startTime || ''))

  const firstBooking = sortedBookings[0]
  const venueName = firstBooking.venueId?.name ?? '—'
  const venueArea = firstBooking.venueId?.area ?? ''

  // Dates & Multi-date detection
  const uniqueDates = Array.from(new Set(sortedBookings.map((b) => b.date).filter(Boolean))).sort()
  const isMultiDate = uniqueDates.length > 1
  const dateRangeLabel = isMultiDate
    ? `${formatDate(uniqueDates[0])} – ${formatDate(uniqueDates[uniqueDates.length - 1])}`
    : formatDate(uniqueDates[0])

  // Order Total = sum of (amount + itemsTotal) over the group's bookings in this tab
  const orderTotal = sortedBookings.reduce(
    (sum, b) => sum + (b.amount || 0) + (b.itemsTotal || 0),
    0
  )

  // Payment status badge logic
  const orderPaymentBadge = getPlayerPaymentBadge(sortedBookings)

  // Add-ons block once from the booking that has items
  const bookingWithItems = sortedBookings.find((b) => Array.isArray(b.items) && b.items.length > 0)

  // Receipt upload: if any booking is pending without a receipt
  const pendingWithoutReceipt = sortedBookings.find(
    (b) => b.status === 'pending' && !b.receiptImage
  )
  const hasReceiptUploaded = sortedBookings.some(
    (b) => b.status === 'pending' && Boolean(b.receiptImage)
  )

  // Highlight check
  const isCardHighlighted = sortedBookings.some((b) => b._id === highlightedBookingId)

  // Help row: call the venue (only if it has a phone) or email CourtEase support with the reference filled in
  const venuePhone = (firstBooking.venueId?.phone || '').trim()
  const orderRef = formatPaymentRef(firstBooking)
  const sessionLines = sortedBookings
    .map((b) => `Court ${b.courtId?.courtNumber ?? '—'} · ${formatDate(b.date)} · ${formatTime(b.startTime)}–${formatTime(b.endTime)}`)
    .join('\n')
  const reportSubject = `Problem with booking ${orderRef}`
  const reportBody = `Booking reference: ${orderRef}\nVenue: ${venueName}${venueArea ? ` (${venueArea})` : ''}\nSessions:\n${sessionLines}\n\nWhat happened:\n`
  const reportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(reportSubject)}&body=${encodeURIComponent(reportBody)}`

  return (
    <div
      className={`card p-5 animate-fadeIn transition-all duration-500 space-y-4 ${
        isCardHighlighted ? 'ring-2 ring-emerald-500 ring-offset-2 shadow-lg' : ''
      }`}
    >
      {/* ── Order Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3.5 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
            <BuildingOffice2Icon className="h-5 w-5 text-primary-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-base leading-snug">
                {venueName}
              </h3>
              {venueArea && (
                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                  <MapPinIcon className="h-3 w-3 text-gray-400" />
                  {venueArea}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1 font-medium text-gray-700">
                <CalendarDaysIcon className="h-3.5 w-3.5 text-gray-400" />
                {dateRangeLabel}
              </span>
              <span className="text-gray-300">·</span>
              <span>
                Ref <span className="font-mono font-medium text-gray-700">{formatPaymentRef(firstBooking)}</span>
              </span>
              <span className="text-gray-300">·</span>
              <span className="font-medium text-gray-700">{formatPaymentMethod(firstBooking.paymentMethod)}</span>
            </div>
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Order Total:</span>
            <span className="font-bold text-base text-primary-700">
              {formatCurrency(orderTotal)}
            </span>
          </div>
          {orderPaymentBadge && (
            <Badge
              status={orderPaymentBadge.status}
              label={orderPaymentBadge.label}
            />
          )}
        </div>
      </div>

      {/* ── Booking Rows ── */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Sessions ({sortedBookings.length})
        </p>

        {sortedBookings.map((b) => {
          const courtNum = b.courtId?.courtNumber ?? '—'
          const canCancel = b.canCancel
          const canReschedule = b.canReschedule
          const canReview = b.canReview
          const myReview = b.myReview
          const isRowHighlighted = b._id === highlightedBookingId

          return (
            <div
              key={b._id}
              id={`booking-${b._id}`}
              className={`p-3 rounded-xl border transition-all ${
                isRowHighlighted
                  ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400'
                  : 'bg-gray-50/70 border-gray-100'
              } flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}
            >
              {/* Left/Top: Court, Time, Amount, Status */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">
                    Court {courtNum}
                  </span>

                  <span className="text-xs text-gray-600 flex items-center gap-1 font-medium">
                    <ClockIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    {isMultiDate && (
                      <span className="text-gray-700 font-semibold">{formatDate(b.date)} · </span>
                    )}
                    {formatTime(b.startTime)}–{formatTime(b.endTime)}
                  </span>

                  <span className="font-bold text-xs text-primary-700">
                    {formatCurrency(b.amount)}
                  </span>

                  <div className="flex items-center gap-1">
                    <Badge status={b.status} />
                    {b.autoConfirmed && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        Auto-confirmed
                      </span>
                    )}
                    {b.rescheduleCount > 0 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Rescheduled
                      </span>
                    )}
                  </div>
                </div>

                {/* Rescheduled-from note */}
                {b.rescheduleCount > 0 && b.rescheduledFrom && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                    <ArrowPathIcon className="h-3 w-3 shrink-0" />
                    Rescheduled from {formatDate(b.rescheduledFrom.date)}, {formatTime(b.rescheduledFrom.startTime)}
                  </p>
                )}

                {/* Rejection reason */}
                {b.status === 'rejected' && b.rejectionReason && (
                  <p className="text-[11px] text-red-600 leading-tight">
                    Reason: {b.rejectionReason}
                  </p>
                )}
              </div>

              {/* Right/Bottom: Actions (full-width on mobile < sm, on the right for sm+) */}
              <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/50">
                {(canCancel || canReschedule) && (
                  <button
                    id={`cancel-booking-${b._id}`}
                    type="button"
                    onClick={() => onOpenCancel(b._id)}
                    className="btn-danger btn-sm flex-1 sm:flex-initial text-xs flex items-center justify-center gap-1 px-2.5 py-1"
                  >
                    <XCircleIcon className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                )}

                {canReview && (
                  <button
                    id={`review-booking-${b._id}`}
                    type="button"
                    onClick={() => onOpenReview(b._id)}
                    className="btn-secondary btn-sm flex-1 sm:flex-initial text-xs flex items-center justify-center gap-1 px-2.5 py-1"
                  >
                    <StarSolid className="h-3.5 w-3.5 text-amber-400" />
                    Rate &amp; Review
                  </button>
                )}

                {myReview && (
                  <div className="flex items-center gap-1 text-xs">
                    {[1, 2, 3, 4, 5].map((s) => (
                      s <= myReview.rating ? (
                        <StarSolid key={s} className="h-3.5 w-3.5 text-amber-400" />
                      ) : (
                        <StarOutline key={s} className="h-3.5 w-3.5 text-amber-300" />
                      )
                    ))}
                    <span className="text-[11px] text-gray-500 ml-1">Reviewed</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Add-ons Block (Once for the order) ── */}
      {bookingWithItems && (
        <div className="pt-3 border-t border-gray-100 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700">Add-ons</span>
            <span className="text-[11px] text-gray-400">Collect at the venue</span>
          </div>

          <div className="bg-gray-50 rounded-lg p-2.5 space-y-1.5 border border-gray-100">
            {bookingWithItems.items.map((item, idx) => (
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
                  bookingWithItems.itemsTotal ??
                    bookingWithItems.items.reduce(
                      (sum, it) => sum + (it.unitPrice || 0) * (it.quantity || 1),
                      0
                    )
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Order Footer: Receipt Upload Action / Status ── */}
      {(pendingWithoutReceipt || hasReceiptUploaded) && (
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
          {pendingWithoutReceipt ? (
            <div className="flex items-center justify-between w-full gap-3">
              <span className="text-xs text-amber-600 font-medium">
                {pendingWithoutReceipt.receiptRequest?.reason
                  ? `The venue asked for a new receipt: ${pendingWithoutReceipt.receiptRequest.reason}`
                  : 'Payment receipt required for confirmation'}
              </span>
              <button
                type="button"
                onClick={() => onOpenUpload(pendingWithoutReceipt._id)}
                className="btn-primary btn-sm text-xs flex items-center gap-1.5 px-3 py-1.5"
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                {pendingWithoutReceipt.receiptRequest ? 'Upload new receipt' : 'Upload Receipt'}
              </button>
            </div>
          ) : hasReceiptUploaded ? (
            <div className="flex items-center gap-1.5 text-primary-600 text-xs font-medium">
              <CheckCircleIcon className="h-4 w-4" />
              <span>Receipt uploaded — awaiting venue verification</span>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Help row: collapsed by default ── */}
      <div className="pt-3 border-t border-gray-100">
        <details className="group">
          <summary className="list-none cursor-pointer flex items-center justify-between gap-2 text-xs font-medium text-gray-500">
            Need help with this booking?
            <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            {venuePhone && (
              <a
                href={`tel:${venuePhone.replace(/[^\d+]/g, '')}`}
                className="btn-secondary btn-sm text-xs w-full sm:w-auto justify-center inline-flex items-center gap-1.5"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
                Call venue · {venuePhone}
              </a>
            )}
            <a
              href={reportHref}
              className="btn-secondary btn-sm text-xs w-full sm:w-auto justify-center inline-flex items-center gap-1.5"
            >
              <EnvelopeIcon className="h-3.5 w-3.5" />
              Report a problem
            </a>
            <Link to="/help" className="text-xs text-primary-700 text-center sm:ml-1 hover:underline py-1">
              Who to contact?
            </Link>
          </div>
        </details>
      </div>
    </div>
  )
}
