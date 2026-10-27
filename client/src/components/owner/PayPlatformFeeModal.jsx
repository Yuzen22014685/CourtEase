import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Spinner from '../ui/Spinner'
import ErrorMessage from '../ui/ErrorMessage'
import { formatCurrency, formatMonth, getImageUrl } from '../../utils/format'
import { getCommissionPaymentInfo, uploadCommissionReceipt } from '../../api/admin'
import {
  ClipboardDocumentIcon,
  CheckIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  QrCodeIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

export default function PayPlatformFeeModal({ statement, onClose, onDone }) {
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [infoError, setInfoError] = useState(null)
  const [platformInfo, setPlatformInfo] = useState(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const [copiedRef, setCopiedRef] = useState(false)
  const [copiedAcc, setCopiedAcc] = useState(false)

  const [successDetails, setSuccessDetails] = useState(null)

  useEffect(() => {
    let active = true
    setLoadingInfo(true)
    setInfoError(null)

    getCommissionPaymentInfo()
      .then((res) => {
        if (active) {
          setPlatformInfo(res.data?.data || null)
        }
      })
      .catch((err) => {
        if (active) {
          setInfoError(err.response?.data?.message || 'Failed to load platform payment details.')
        }
      })
      .finally(() => {
        if (active) {
          setLoadingInfo(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  if (!statement) return null

  const paymentInfo = platformInfo?.paymentInfo
  const hasQr = Boolean(paymentInfo?.duitNowQr && String(paymentInfo.duitNowQr).trim())
  const hasBank = Boolean(
    paymentInfo?.bankName && String(paymentInfo.bankName).trim() &&
    paymentInfo?.accountName && String(paymentInfo.accountName).trim() &&
    paymentInfo?.accountNumber && String(paymentInfo.accountNumber).trim()
  )
  const hasAnyPayment = hasQr || hasBank

  const copyToClipboard = async (text, setCopied) => {
    if (!text) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }
    } catch {
      // fallback if clipboard permission blocked
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      setUploadError('Please select a JPG or PNG image.')
      setSelectedFile(null)
      setPreviewUrl(null)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be 5MB or less.')
      setSelectedFile(null)
      setPreviewUrl(null)
      return
    }

    setSelectedFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setUploadError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile || !statement?._id) return

    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('receipt', selectedFile)

    try {
      await uploadCommissionReceipt(statement._id, formData)
      setSuccessDetails({
        month: statement.month,
        amountDue: statement.amountDue,
        paymentRef: statement.paymentRef,
      })
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Failed to upload receipt. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // Closing while on the success view must refresh the parent list
  const handleModalClose = () => {
    if (successDetails) {
      onDone()
    } else {
      onClose()
    }
  }

  return (
    <Modal
      isOpen={Boolean(statement)}
      onClose={handleModalClose}
      title={successDetails ? 'Payment submitted' : `Pay platform fee — ${formatMonth(statement.month)}`}
      size={successDetails ? 'md' : 'lg'}
    >
      {successDetails ? (
        <div className="space-y-5 text-gray-800 py-1">
          {/* Success Icon */}
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto">
            <CheckCircleIcon className="h-8 w-8 text-primary-600" />
          </div>

          {/* Heading */}
          <h3 className="text-base sm:text-lg font-bold text-gray-900 text-center">
            Receipt uploaded successfully
          </h3>

          {/* Statement Details */}
          <div className="p-3.5 sm:p-4 bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-100 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500">Month</span>
              <span className="font-semibold text-gray-900">{formatMonth(successDetails.month)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-primary-700">{formatCurrency(successDetails.amountDue)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500">Reference</span>
              <span className="font-mono font-bold text-gray-900 select-all tracking-wider">{successDetails.paymentRef}</span>
            </div>
          </div>

          {/* Verification Notice */}
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            CourtEase will verify your payment shortly. You&apos;ll see the status update on this page.
          </p>

          {/* Done Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onDone}
              className="btn-primary w-full text-xs sm:text-sm py-2.5"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 text-gray-800">
        {/* Rejection Warning Box */}
        {statement.rejectionReason && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Your previous receipt was rejected:</p>
              <p className="mt-0.5">{statement.rejectionReason}</p>
              <p className="mt-1 text-red-700">Please upload a new payment receipt below.</p>
            </div>
          </div>
        )}

        {/* Amount Due Box */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs uppercase font-semibold text-gray-500 tracking-wider">
              Amount Due
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-primary-700">
              {formatCurrency(statement.amountDue)}
            </div>
          </div>
          <div className="text-xs text-gray-600 sm:text-right">
            <div>
              Court revenue {formatCurrency(statement.courtRevenue)} × {statement.rate}%
            </div>
            {statement.includeAddOns && (
              <div className="text-primary-700 font-medium">
                (add-ons included)
              </div>
            )}
          </div>
        </div>

        {/* Payment Reference Box */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Payment Reference
          </label>
          <div className="p-3 bg-gray-50 border border-gray-300 rounded-xl flex items-center justify-between gap-3">
            <span className="font-mono text-base sm:text-lg font-bold text-gray-900 tracking-wider select-all">
              {statement.paymentRef}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(statement.paymentRef, setCopiedRef)}
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
            <span>Put this reference in your transfer note so CourtEase can match your payment.</span>
          </p>
        </div>

        {/* Platform Payment Info (QR / Bank) */}
        {loadingInfo ? (
          <div className="p-6 flex flex-col items-center justify-center min-h-[120px] bg-gray-50 rounded-xl border border-gray-200">
            <Spinner size="md" />
            <p className="text-xs text-gray-500 mt-2">Loading platform payment details…</p>
          </div>
        ) : infoError ? (
          <ErrorMessage message={infoError} />
        ) : !hasAnyPayment ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <InformationCircleIcon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              CourtEase has not set up payment details yet — please contact the admin.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* DuitNow QR */}
            {hasQr && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <QrCodeIcon className="h-4 w-4 text-primary-600" />
                  <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    DuitNow QR
                  </h5>
                </div>
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-gray-200">
                  <img
                    src={getImageUrl(paymentInfo.duitNowQr)}
                    alt="Platform DuitNow QR Code"
                    className="max-h-56 max-w-full object-contain rounded"
                  />
                  <p className="text-[11px] text-gray-500 text-center font-medium mt-2">
                    Scan with your online banking or e-wallet app
                  </p>
                </div>
              </div>
            )}

            {/* Bank Details */}
            {hasBank && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <BanknotesIcon className="h-4 w-4 text-primary-600" />
                  <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    {hasQr ? 'Or pay by Bank Transfer' : 'Bank Transfer'}
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
                      <span className="font-mono font-bold text-gray-900 text-sm select-all tracking-wider">
                        {paymentInfo.accountNumber}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentInfo.accountNumber, setCopiedAcc)}
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
            )}
          </div>
        )}

        {/* Receipt Upload Form */}
        <form onSubmit={handleSubmit} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <PhotoIcon className="h-4 w-4 text-primary-600" />
            <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Upload Payment Receipt
            </h5>
          </div>

          <ErrorMessage message={uploadError} />

          {/* File Picker or Preview */}
          {!selectedFile ? (
            <div>
              <label
                htmlFor="commission-receipt-upload"
                className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  !hasAnyPayment || loadingInfo
                    ? 'border-gray-200 bg-gray-100/50 cursor-not-allowed opacity-60'
                    : 'border-gray-300 hover:border-primary-500 bg-white'
                }`}
              >
                <PhotoIcon className="h-8 w-8 text-gray-400 mb-1" />
                <span className="text-xs font-semibold text-gray-800">
                  Click to select payment receipt
                </span>
                <span className="text-[11px] text-gray-500 mt-0.5">
                  JPG or PNG, up to 5MB
                </span>
                <input
                  id="commission-receipt-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  disabled={!hasAnyPayment || loadingInfo || uploading}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Receipt preview"
                      className="w-12 h-12 object-cover rounded-lg border border-gray-200 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearFile}
                  disabled={uploading}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  aria-label="Remove selected receipt"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="btn-secondary text-xs px-4 py-2"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!selectedFile || !hasAnyPayment || uploading}
              className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5"
            >
              {uploading ? (
                <>
                  <Spinner size="sm" />
                  <span>Uploading receipt…</span>
                </>
              ) : (
                <span>Submit receipt</span>
              )}
            </button>
          </div>
        </form>
      </div>
      )}
    </Modal>
  )
}
