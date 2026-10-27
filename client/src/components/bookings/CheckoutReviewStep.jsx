import { useState, useMemo } from 'react'
import { formatCurrency, formatDate, formatTime } from '../../utils/format'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import Spinner from '../ui/Spinner'
import clsx from 'clsx'

const slotKey = (courtId, start) => `${courtId}::${start}`

export default function CheckoutReviewStep({
  cart,
  venue,
  date,
  selectedAddOns = {},
  shopItems = [],
  paymentMethod,
  availablePaymentMethods = [],
  onPaymentChange,
  canGoBack = false,
  onBack,
  onSubmit,
  loading = false,
}) {
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTermsWarning, setShowTermsWarning] = useState(false)

  const hasPaymentOptions = availablePaymentMethods.length > 0
  const courtPriceTotal = cart.reduce((sum, item) => sum + (item.price ?? venue?.pricePerHour ?? 0), 0)

  const chosenAddOns = useMemo(() => {
    return Object.entries(selectedAddOns)
      .filter(([_, val]) => val && val.quantity > 0)
      .map(([itemId, val]) => {
        const item = shopItems.find((i) => i._id === itemId)
        const unitPrice = item?.price || 0
        return {
          id: itemId,
          name: item?.name || 'Add-on',
          quantity: val.quantity,
          note: val.note || '',
          unitPrice,
          lineTotal: val.quantity * unitPrice,
        }
      })
  }, [selectedAddOns, shopItems])

  const addOnsTotal = useMemo(() => {
    return chosenAddOns.reduce((sum, a) => sum + a.lineTotal, 0)
  }, [chosenAddOns])

  const grandTotal = courtPriceTotal + addOnsTotal

  const handleSubmitClick = () => {
    if (!termsAccepted) {
      setShowTermsWarning(true)
      return
    }
    setShowTermsWarning(false)
    onSubmit()
  }

  return (
    <div className="space-y-6">
      {/* ── Order Summary ── */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm border border-gray-100">
        <div className="flex justify-between items-center text-gray-500 text-xs border-b border-gray-200/60 pb-2">
          <span className="font-semibold text-gray-700">{venue?.name}</span>
          <span>{cart.length} slot{cart.length !== 1 ? 's' : ''} · {formatDate(date)}</span>
        </div>

        {/* Slots List */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Court Sessions
          </p>
          {cart.map((slot) => (
            <div key={slotKey(slot.courtId, slot.start)} className="flex justify-between text-xs">
              <span className="text-gray-700">
                Court {slot.courtNumber} · {formatTime(slot.start)}–{formatTime(slot.end)}
              </span>
              <span className="font-medium text-gray-800 shrink-0 ml-2">
                {formatCurrency(slot.price ?? venue?.pricePerHour ?? 0)}
              </span>
            </div>
          ))}
        </div>

        {/* Add-ons List (if any chosen) */}
        {chosenAddOns.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-gray-200/60">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Add-ons
            </p>
            {chosenAddOns.map((item) => (
              <div key={item.id} className="text-xs space-y-0.5">
                <div className="flex justify-between text-gray-800">
                  <span>
                    {item.quantity} × {item.name}
                  </span>
                  <span className="font-medium shrink-0 ml-2">
                    {formatCurrency(item.lineTotal)}
                  </span>
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

        {/* Totals Breakdown */}
        <div className="pt-2 border-t border-gray-200 space-y-1 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Courts</span>
            <span className="font-medium text-gray-800">{formatCurrency(courtPriceTotal)}</span>
          </div>
          {addOnsTotal > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Add-ons</span>
              <span className="font-medium text-gray-800">{formatCurrency(addOnsTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-gray-200 text-sm">
            <span className="font-bold text-gray-900">Total</span>
            <span className="text-lg font-bold text-primary-600">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Payment Method Radios ── */}
      <div className="space-y-2">
        <label className="label">Payment method</label>
        {!hasPaymentOptions ? (
          <p className="text-sm text-gray-500 italic">This venue hasn't set up payment details yet.</p>
        ) : (
          <div className="space-y-2">
            {availablePaymentMethods.map((m) => (
              <label
                key={m.value}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                  paymentMethod === m.value
                    ? 'border-primary-500 bg-primary-50/40 text-gray-900 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.value}
                  checked={paymentMethod === m.value}
                  onChange={(e) => onPaymentChange(e.target.value)}
                  disabled={loading}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="text-sm">{m.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Terms & Conditions ── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Terms &amp; Conditions
        </p>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400 shrink-0">•</span>
            <span>Payment is made directly to the venue by DuitNow QR or bank transfer. CourtEase does not process or hold payments.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400 shrink-0">•</span>
            <span>All bookings are non-refundable.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400 shrink-0">•</span>
            <span>You can reschedule a booking once, up to 24 hours before the session starts (same venue, same duration).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400 shrink-0">•</span>
            <span>You can cancel a booking any time before the session starts, but the booking fee will not be refunded.</span>
          </li>
          {chosenAddOns.length > 0 && (
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-gray-400 shrink-0">•</span>
              <span>Add-ons belong to this order. If you cancel the session they're listed under, they move to your next session — they're only forfeited if every session in the order is cancelled. Add-ons aren't refunded.</span>
            </li>
          )}
        </ul>

        {/* Checkbox */}
        <label
          htmlFor="terms-checkbox"
          className="flex items-start gap-2.5 cursor-pointer group pt-1"
        >
          <input
            id="terms-checkbox"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => {
              setTermsAccepted(e.target.checked)
              if (e.target.checked) setShowTermsWarning(false)
            }}
            disabled={loading}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer accent-primary-600 shrink-0"
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-snug">
            I have read and agree to the Terms &amp; Conditions
          </span>
        </label>

        {showTermsWarning && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
            Please accept the Terms &amp; Conditions before proceeding.
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-xl">
          <Spinner size="sm" />
          <p className="text-sm text-primary-700">
            Processing bookings sequentially… please wait.
          </p>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 text-center">
          Add-ons can't be changed after you confirm.
        </p>
        <div className="flex gap-3">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-secondary px-5"
              disabled={loading}
            >
              Back
            </button>
          )}
          <button
            id="confirm-booking-btn"
            type="button"
            onClick={handleSubmitClick}
            disabled={loading || cart.length === 0 || !hasPaymentOptions}
            className="btn-primary flex-1"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" /> Processing…
              </span>
            ) : (
              'Confirm booking'
            )}
          </button>
        </div>
      </div>

      {!hasPaymentOptions && (
        <p className="text-xs text-red-500 text-center -mt-2 font-medium">
          This venue hasn't set up payment details yet.
        </p>
      )}
      <p className="text-xs text-gray-400 text-center">
        You pay the venue directly. CourtEase never handles your money.
      </p>
    </div>
  )
}
