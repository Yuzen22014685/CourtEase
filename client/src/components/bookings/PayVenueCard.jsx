import { useState, useEffect, useRef } from 'react'
import { getBookingPaymentInfo } from '../../api/bookings'
import { formatCurrency, getImageUrl } from '../../utils/format'
import Spinner from '../ui/Spinner'
import ErrorMessage from '../ui/ErrorMessage'
import {
  ClipboardDocumentIcon,
  CheckIcon,
  InformationCircleIcon,
  QrCodeIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'

export default function PayVenueCard({ bookingId, chosenMethod }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paymentData, setPaymentData] = useState(null)

  const [copiedRef, setCopiedRef] = useState(false)
  const [copiedAcc, setCopiedAcc] = useState(false)
  const refTextRef = useRef(null)
  const accTextRef = useRef(null)

  useEffect(() => {
    if (!bookingId) return
    let mounted = true
    setLoading(true)
    setError(null)

    getBookingPaymentInfo(bookingId)
      .then((res) => {
        if (mounted) {
          setPaymentData(res.data?.data || null)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.response?.data?.message || 'Failed to load payment details.')
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [bookingId])

  const copyToClipboard = async (text, setCopied, elemRef) => {
    if (!text) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }
    } catch {
      // Fallback below
    }

    if (elemRef?.current) {
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(elemRef.current)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center min-h-[160px] bg-white border border-gray-200">
        <Spinner size="md" />
        <p className="text-xs text-gray-500 mt-2">Loading payment details…</p>
      </div>
    )
  }

  if (error || !paymentData) {
    return (
      <div className="card p-5 bg-white border border-gray-200">
        <ErrorMessage message={error || 'Payment details unavailable.'} />
      </div>
    )
  }

  const { venueName, paymentInfo, paymentRef, groupTotal } = paymentData
  const addonItems = paymentData.items || groupTotal?.items || []
  const hasAddOns = (groupTotal?.itemsTotal ?? 0) > 0
  const slotCount = groupTotal?.count ?? 1

  const hasQr = Boolean(paymentInfo?.duitNowQr && String(paymentInfo.duitNowQr).trim())
  const hasBank = Boolean(
    paymentInfo?.bankName && String(paymentInfo.bankName).trim() &&
    paymentInfo?.accountName && String(paymentInfo.accountName).trim() &&
    paymentInfo?.accountNumber && String(paymentInfo.accountNumber).trim()
  )

  const showBankFirst = chosenMethod === 'bank_transfer' && hasBank

  const renderQrSection = (isSecondary = false) => (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <div className="flex items-center gap-2">
        <QrCodeIcon className="h-4 w-4 text-primary-600" />
        <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
          {isSecondary ? 'Or pay by DuitNow QR' : 'DuitNow QR'}
        </h5>
      </div>

      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-gray-200">
        <img
          src={getImageUrl(paymentInfo.duitNowQr)}
          alt="Venue DuitNow QR Code"
          className="max-h-56 max-w-full object-contain rounded"
        />
        <p className="text-[11px] text-gray-500 text-center font-medium mt-2">
          Scan with your online banking or e-wallet app
        </p>
      </div>
    </div>
  )

  const renderBankSection = (isSecondary = false) => (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <div className="flex items-center gap-2">
        <BanknotesIcon className="h-4 w-4 text-primary-600" />
        <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
          {isSecondary ? 'Or pay by Bank Transfer' : 'Bank Transfer'}
        </h5>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 text-xs overflow-hidden">
        <div className="p-3 flex justify-between items-center gap-2">
          <span className="text-gray-500">Bank Name</span>
          <span className="font-semibold text-gray-900 text-right">{paymentInfo.bankName}</span>
        </div>

        <div className="p-3 flex justify-between items-center gap-2">
          <span className="text-gray-500">Account Holder</span>
          <span className="font-semibold text-gray-900 text-right">{paymentInfo.accountName}</span>
        </div>

        <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50">
          <div>
            <span className="text-gray-500 block sm:inline">Account Number: </span>
            <span
              ref={accTextRef}
              className="font-mono font-bold text-gray-900 text-sm select-all tracking-wider"
            >
              {paymentInfo.accountNumber}
            </span>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(paymentInfo.accountNumber, setCopiedAcc, accTextRef)}
            className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1 self-start sm:self-auto shrink-0"
          >
            {copiedAcc ? (
              <>
                <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="card p-5 sm:p-6 bg-white border border-gray-200 shadow-sm space-y-5">
      {/* Title & Group Total */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-gray-100 pb-4">
        <div>
          <h4 className="text-base sm:text-lg font-bold text-gray-900">
            Pay {venueName} directly
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            CourtEase never handles the money — your payment goes straight to the venue.
          </p>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <div className="text-lg sm:text-xl font-extrabold text-primary-600">
            {formatCurrency(groupTotal?.amount ?? 0)}
          </div>
          {hasAddOns ? (
            <div className="mt-1.5 space-y-0.5 text-xs text-gray-600 sm:text-right">
              <div>
                Courts: {formatCurrency(groupTotal?.courtTotal ?? 0)} ({slotCount} slot{slotCount !== 1 ? 's' : ''})
              </div>
              <div>
                Add-ons: {formatCurrency(groupTotal?.itemsTotal ?? 0)}
              </div>
              {addonItems.map((item, idx) => (
                <div key={idx} className="text-[11px] text-gray-500">
                  <span>{item.quantity} × {item.name}</span>
                  {item.note && (
                    <p className="text-[10px] text-gray-400 italic">
                      {item.note}
                    </p>
                  )}
                </div>
              ))}
              <div className="font-semibold text-gray-900 pt-0.5">
                Total: {formatCurrency(groupTotal?.amount ?? 0)}
              </div>
            </div>
          ) : (
            groupTotal?.count > 1 && (
              <span className="text-xs font-medium text-gray-500">
                ({groupTotal.count} slots)
              </span>
            )
          )}
        </div>
      </div>

      {/* Payment Reference Box */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Payment Reference
        </label>

        <div className="p-3 sm:p-3.5 bg-gray-50 border border-gray-300 rounded-xl flex items-center justify-between gap-3">
          <span
            ref={refTextRef}
            className="font-mono text-base sm:text-lg font-bold text-gray-900 tracking-wider select-all"
          >
            {paymentRef}
          </span>

          <button
            type="button"
            onClick={() => copyToClipboard(paymentRef, setCopiedRef, refTextRef)}
            className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 shrink-0"
          >
            {copiedRef ? (
              <>
                <CheckIcon className="h-4 w-4 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-4 w-4" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5 pt-0.5">
          <InformationCircleIcon className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Put this reference in your transfer note so the venue can match your payment.</span>
        </p>
      </div>

      {/* Methods (ordered by chosenMethod) */}
      <div className="space-y-4 pt-1">
        {showBankFirst ? (
          <>
            {renderBankSection(false)}
            {hasQr && renderQrSection(true)}
          </>
        ) : (
          <>
            {hasQr && renderQrSection(false)}
            {hasBank && renderBankSection(hasQr)}
          </>
        )}
      </div>
    </div>
  )
}
