import { useState, useEffect } from 'react'
import { verifyCommissionStatement, rejectCommissionStatement } from '../../api/admin'
import { formatCurrency, formatMonth, formatDateTime, getImageUrl } from '../../utils/format'
import Modal from '../ui/Modal'
import Spinner from '../ui/Spinner'
import ErrorMessage from '../ui/ErrorMessage'
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export default function CommissionReviewModal({ statement, onClose, onDone }) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [statement?.receiptImage])

  if (!statement) return null

  const receiptUrl = statement.receiptImage ? getImageUrl(statement.receiptImage) : ''

  const handleVerify = async () => {
    setProcessing(true)
    setError(null)
    try {
      await verifyCommissionStatement(statement._id)
      window.dispatchEvent(new Event('commission-count-changed'))
      onDone?.()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify statement')
    } finally {
      setProcessing(false)
    }
  }

  const handleConfirmReject = async () => {
    const trimmed = rejectReason.trim()
    if (!trimmed || trimmed.length < 5) {
      setError('Rejection reason must be at least 5 characters')
      return
    }

    setProcessing(true)
    setError(null)
    try {
      await rejectCommissionStatement(statement._id, trimmed)
      window.dispatchEvent(new Event('commission-count-changed'))
      onDone?.()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject statement')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Modal
      isOpen={Boolean(statement)}
      onClose={processing ? () => {} : onClose}
      title="Review Commission Statement"
      size="lg"
    >
      <div className="space-y-4">
        {error && <ErrorMessage message={error} />}

        {/* Statement Summary Box */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-200/70">
            <div>
              <p className="font-semibold text-gray-900">{statement.venueId?.name || 'Venue'}</p>
              <p className="text-xs text-gray-500">{statement.venueId?.area || 'Penang'}</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-base text-primary-600">
                {formatCurrency(statement.amountDue)}
              </span>
              <p className="text-[11px] text-gray-500 font-medium">
                {statement.rate}% commission
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Billing Month</span>
              <span className="font-medium text-gray-800">
                {formatMonth(statement.month)}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Reference Code</span>
              <span className="font-mono font-medium text-gray-800">
                {statement.paymentRef}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Court Revenue</span>
              <span className="font-medium text-gray-800">
                {formatCurrency(statement.courtRevenue)} ({statement.confirmedSessions || 0} sessions)
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Shop / Add-ons Revenue</span>
              <span className="font-medium text-gray-800">
                {formatCurrency(statement.shopRevenue)}{' '}
                <span className="text-[10px] text-gray-500">
                  {statement.includeAddOns ? '(included in base)' : '(not included)'}
                </span>
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Commission Base</span>
              <span className="font-medium text-gray-800">
                {formatCurrency(statement.base)}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Submitted At</span>
              <span className="font-medium text-gray-800">
                {statement.submittedAt ? formatDateTime(statement.submittedAt) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Proof of Payment Section */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
            Proof of Payment Receipt
          </label>
          {statement.receiptImage ? (
            <div className="bg-gray-100/70 border border-gray-200 rounded-xl p-2 flex flex-col items-center justify-center">
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block cursor-zoom-in group text-center w-full"
                title="Click to view full size in new tab"
              >
                {!imgError ? (
                  <img
                    src={receiptUrl}
                    alt="Proof of Payment Receipt"
                    onError={() => setImgError(true)}
                    className="max-h-[45vh] max-w-full object-contain rounded-lg shadow-sm mx-auto"
                  />
                ) : (
                  <div className="py-8 px-4 text-center text-amber-800 text-xs">
                    <ExclamationTriangleIcon className="h-6 w-6 text-amber-500 mx-auto mb-1" />
                    <p className="font-semibold">Unable to preview receipt</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      The uploaded file could not be decoded as an image. Click to view raw file ↗
                    </p>
                  </div>
                )}
                <span className="inline-block text-[11px] text-gray-500 mt-1.5 group-hover:text-primary-600 transition-colors">
                  Click to open full size in new tab ↗
                </span>
              </a>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-800 text-sm">
              <ExclamationTriangleIcon className="h-6 w-6 text-amber-500 mx-auto mb-1" />
              <p className="font-semibold">No receipt uploaded yet</p>
            </div>
          )}
        </div>

        {/* Rejection Form (Revealed upon clicking Reject) */}
        {showRejectForm && (
          <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl space-y-2">
            <label htmlFor="rejection-reason-textarea" className="block text-xs font-semibold text-red-900">
              Reason for Rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              id="rejection-reason-textarea"
              rows={3}
              maxLength={300}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Amount transferred does not match amount due, or unreadable receipt image."
              className="input w-full text-xs"
              disabled={processing}
            />
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>Minimum 5 characters. Venue owner will see this reason.</span>
              <span>{rejectReason.length}/300</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="btn-secondary text-xs px-4 py-2 w-full sm:w-auto"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!showRejectForm ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  disabled={processing}
                  className="btn-danger text-xs px-4 py-2 w-full sm:w-auto"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={processing}
                  className="btn-primary text-xs px-4 py-2 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  {processing ? (
                    <>
                      <Spinner size="sm" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-4 w-4" />
                      <span>Verify payment</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectForm(false)
                    setRejectReason('')
                    setError(null)
                  }}
                  disabled={processing}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={processing || rejectReason.trim().length < 5}
                  className="btn-danger text-xs px-4 py-2 inline-flex items-center justify-center gap-1.5"
                >
                  {processing ? (
                    <>
                      <Spinner size="sm" />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <span>Confirm reject</span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
