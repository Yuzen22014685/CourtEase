import { Link } from 'react-router-dom'
import { formatCurrency, formatDate, formatTime } from '../../utils/format'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export default function CheckoutDoneSummary({
  results,
  venue,
  date,
  uploadSkipped = false,
  onBookMore,
}) {
  const { successes = [], failures = [] } = results || {}
  const allFailed = successes.length === 0
  const allOk = failures.length === 0

  const firstSuccess = successes[0]
  const paymentRef = firstSuccess?.paymentRef || firstSuccess?.receiptId

  // Server response items stored in results.successes[0]
  const serverItems = firstSuccess?.items || []
  const serverItemsTotal = firstSuccess?.itemsTotal || 0

  const courtTotal = successes.reduce((sum, s) => sum + (s.amount ?? 0), 0)
  const grandTotal = courtTotal + serverItemsTotal
  const totalLabel = uploadSkipped ? 'Amount to pay' : 'Total'

  return (
    <div className="space-y-5">
      {/* ── Status Header ── */}
      <div
        className={clsx(
          'flex flex-col items-center gap-3 py-4 text-center',
          allFailed ? 'text-red-600' : allOk ? 'text-primary-700' : 'text-amber-600'
        )}
      >
        <div
          className={clsx(
            'w-14 h-14 rounded-full flex items-center justify-center',
            allFailed ? 'bg-red-100' : allOk ? 'bg-primary-100' : 'bg-amber-100'
          )}
        >
          {allFailed ? (
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
          ) : (
            <CheckCircleIcon className="h-8 w-8 text-primary-600" />
          )}
        </div>

        <div>
          <h3 className="font-bold text-gray-900 text-lg">
            {allFailed ? 'Booking failed' : 'Booking submitted'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {allFailed
              ? "We couldn't confirm your selected sessions. Please review below."
              : uploadSkipped
              ? 'Payment pending — upload your receipt in My Bookings'
              : `Waiting for ${venue?.name || 'the venue'} to verify your payment`}
          </p>
        </div>
      </div>

      {/* ── Payment Reference Pill (Only when there are successes) ── */}
      {!allFailed && paymentRef && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">Payment Reference</span>
          <span className="font-mono font-bold text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-200 select-all tracking-wider">
            {paymentRef}
          </span>
        </div>
      )}

      {/* ── Submitted Sessions (Explicitly NOT 'Confirmed') ── */}
      {successes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            Submitted ({successes.length})
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-xs text-gray-500 border-b border-gray-200/60 pb-2">
              <span className="font-medium text-gray-700">{venue?.name}</span>
              <span>{formatDate(date)}</span>
            </div>

            {/* Slots list */}
            <div className="space-y-1.5">
              {successes.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-gray-700">
                    Court {item.courtNumber} · {formatTime(item.start)}–{formatTime(item.end)}
                  </span>
                  <span className="font-medium text-gray-800 shrink-0 ml-2">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Add-on lines from server snapshot */}
            {serverItems.length > 0 && (
              <div className="pt-2 border-t border-gray-200/60 space-y-1.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Add-ons
                </p>
                {serverItems.map((item, idx) => (
                  <div key={idx} className="text-xs space-y-0.5">
                    <div className="flex justify-between text-gray-800">
                      <span>{item.quantity} × {item.name}</span>
                      {item.unitPrice !== undefined && (
                        <span className="font-medium shrink-0 ml-2">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </span>
                      )}
                    </div>
                    {item.note && (
                      <p className="text-[11px] text-gray-500 pl-3 italic">
                        Note: {item.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Price breakdown — never the word 'paid' before verification */}
            <div className="pt-2 border-t border-gray-200 space-y-1 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Courts</span>
                <span className="font-medium text-gray-800">{formatCurrency(courtTotal)}</span>
              </div>
              {serverItemsTotal > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Add-ons</span>
                  <span className="font-medium text-gray-800">{formatCurrency(serverItemsTotal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-gray-200 text-sm font-bold text-gray-900">
                <span>{totalLabel}</span>
                <span className="text-primary-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Failed Sessions (kept as is) ── */}
      {failures.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1.5">
            <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" />
            Failed ({failures.length})
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl divide-y divide-red-100 overflow-hidden">
            {failures.map((item, idx) => (
              <div key={idx} className="px-4 py-3 text-sm">
                <p className="font-medium text-gray-900">
                  Court {item.courtNumber} · {formatTime(item.start)}–{formatTime(item.end)}
                </p>
                <p className="text-xs text-red-600 mt-1">{item.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom Actions ── */}
      {allFailed ? (
        <button
          type="button"
          onClick={onBookMore}
          className="btn-primary w-full"
        >
          Back to venue
        </button>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBookMore}
            className="btn-secondary flex-1"
          >
            Book more slots
          </button>
          <Link
            to="/my-bookings"
            onClick={onBookMore}
            className="btn-primary flex-1 text-center justify-center inline-flex items-center"
          >
            My Bookings
          </Link>
        </div>
      )}
    </div>
  )
}
