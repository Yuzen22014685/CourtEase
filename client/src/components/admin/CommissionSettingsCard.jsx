import { useState, useEffect, useRef } from 'react'
import {
  getCommissionSettings,
  updateCommissionSettings,
  uploadCommissionQr,
  deleteCommissionQr,
} from '../../api/admin'
import { getImageUrl } from '../../utils/format'
import Spinner from '../ui/Spinner'
import ErrorMessage from '../ui/ErrorMessage'
import {
  QrCodeIcon,
  BanknotesIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

export default function CommissionSettingsCard({ onSaved }) {
  const [loading, setLoading] = useState(true)
  const [initialError, setInitialError] = useState(null)

  // Form fields
  const [commissionRate, setCommissionRate] = useState('5')
  const [includeAddOns, setIncludeAddOns] = useState(false)
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')

  // QR state
  const [duitNowQr, setDuitNowQr] = useState('')
  const [uploadingQr, setUploadingQr] = useState(false)
  const [qrError, setQrError] = useState(null)
  const qrFileInputRef = useRef(null)

  // Save state
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [successNotice, setSuccessNotice] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setInitialError(null)

    getCommissionSettings()
      .then((res) => {
        if (!active) return
        const s = res.data?.data || {}
        setCommissionRate(s.commissionRate !== undefined ? String(s.commissionRate) : '5')
        setIncludeAddOns(Boolean(s.includeAddOns))
        setDuitNowQr(s.paymentInfo?.duitNowQr || '')
        setBankName(s.paymentInfo?.bankName || '')
        setAccountName(s.paymentInfo?.accountName || '')
        setAccountNumber(s.paymentInfo?.accountNumber || '')
      })
      .catch((err) => {
        if (!active) return
        setInitialError(err.response?.data?.message || 'Failed to load platform settings')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingQr(true)
    setQrError(null)
    const formData = new FormData()
    formData.append('qr', file)

    try {
      const res = await uploadCommissionQr(formData)
      const newQr = res.data?.duitNowQr || ''
      setDuitNowQr(newQr)
    } catch (err) {
      setQrError(err.response?.data?.message || 'Failed to upload DuitNow QR')
    } finally {
      setUploadingQr(false)
      if (qrFileInputRef.current) {
        qrFileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteQr = async () => {
    setUploadingQr(true)
    setQrError(null)
    try {
      await deleteCommissionQr()
      setDuitNowQr('')
    } catch (err) {
      setQrError(err.response?.data?.message || 'Failed to remove DuitNow QR')
    } finally {
      setUploadingQr(false)
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    setSuccessNotice(null)

    const rateNum = parseFloat(commissionRate)

    try {
      const payload = {
        commissionRate: isNaN(rateNum) ? 0 : rateNum,
        includeAddOns: Boolean(includeAddOns),
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
      }

      const res = await updateCommissionSettings(payload)
      setSuccessNotice('Platform commission settings saved successfully.')
      onSaved?.(res.data?.data)
      setTimeout(() => setSuccessNotice(null), 4000)
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-center justify-center min-h-[200px]">
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <BanknotesIcon className="h-5 w-5 text-primary-600" />
        <h2 className="text-base font-bold text-gray-900">Platform Commission Settings</h2>
      </div>

      {initialError && (
        <div className="mb-4">
          <ErrorMessage message={initialError} />
        </div>
      )}

      {formError && (
        <div className="mb-4">
          <ErrorMessage message={formError} />
        </div>
      )}

      {successNotice && (
        <div className="mb-4 flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Rate and Add-ons row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="commission-rate-input" className="block text-xs font-semibold text-gray-700 mb-1">
              Commission Rate (%)
            </label>
            <div className="relative rounded-lg shadow-sm">
              <input
                id="commission-rate-input"
                type="number"
                min="0"
                max="30"
                step="0.01"
                required
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="5.00"
                className="input w-full text-sm pr-8"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-gray-400 font-medium">
                %
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Platform percentage taken from venue revenue (0% to 30%).</p>
          </div>

          <div className="flex flex-col justify-center pt-1 sm:pt-0">
            <span className="block text-xs font-semibold text-gray-700 mb-2">Revenue Scope</span>
            <label className="relative flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAddOns}
                onChange={(e) => setIncludeAddOns(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <span className="text-xs text-gray-800 font-medium">
                Include shop items / add-ons in commission base
              </span>
            </label>
            <p className="text-[11px] text-gray-500 mt-1 pl-7">
              When checked, add-ons (grips, shuttlecocks, stringing) are taxed alongside court revenue.
            </p>
          </div>
        </div>

        {/* Platform Payment Details Section */}
        <div className="pt-4 border-t border-gray-100 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <QrCodeIcon className="h-4 w-4 text-primary-600" />
              Platform Payment Details
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Venue owners will use these details to pay their monthly platform commission.
            </p>
          </div>

          {/* DuitNow QR section */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  Platform DuitNow QR Code
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload CourtEase official platform QR (PNG or JPG, max 5MB).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={qrFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleQrUpload}
                  disabled={uploadingQr}
                  className="hidden"
                  id="platform-qr-input"
                />
                <label
                  htmlFor="platform-qr-input"
                  className={`btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer ${
                    uploadingQr ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {uploadingQr ? (
                    <>
                      <Spinner size="sm" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpTrayIcon className="h-3.5 w-3.5" />
                      <span>{duitNowQr ? 'Replace QR' : 'Upload QR'}</span>
                    </>
                  )}
                </label>

                {duitNowQr && (
                  <button
                    type="button"
                    onClick={handleDeleteQr}
                    disabled={uploadingQr}
                    className="btn-danger text-xs px-2.5 py-1.5 inline-flex items-center gap-1"
                    title="Remove Platform QR"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>

            {qrError && <ErrorMessage message={qrError} />}

            {duitNowQr ? (
              <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white p-2 flex items-center justify-center">
                <img
                  src={getImageUrl(duitNowQr)}
                  alt="Platform DuitNow QR"
                  className="max-h-52 w-auto object-contain rounded"
                />
              </div>
            ) : (
              <div className="py-6 px-4 border border-dashed border-gray-200 rounded-lg text-center bg-white text-xs text-gray-400 font-medium">
                No platform QR uploaded
              </div>
            )}
          </div>

          {/* Bank Transfer Details Section */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                Platform Bank Account Details
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Bank account for direct transfers by venue owners.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="platform-bank-name" className="block text-xs font-semibold text-gray-700 mb-1">
                  Bank Name
                </label>
                <input
                  id="platform-bank-name"
                  type="text"
                  maxLength={60}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Maybank / CIMB Bank / Public Bank"
                  className="input w-full text-xs"
                />
              </div>

              <div>
                <label htmlFor="platform-account-name" className="block text-xs font-semibold text-gray-700 mb-1">
                  Account Holder Name
                </label>
                <input
                  id="platform-account-name"
                  type="text"
                  maxLength={80}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. CourtEase Platform Sdn Bhd"
                  className="input w-full text-xs"
                />
              </div>

              <div>
                <label htmlFor="platform-account-number" className="block text-xs font-semibold text-gray-700 mb-1">
                  Account Number
                </label>
                <input
                  id="platform-account-number"
                  type="text"
                  maxLength={30}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 5140 1234 5678 (digits, spaces, dashes)"
                  className="input w-full text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Informational note */}
        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
          <InformationCircleIcon className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            Changes apply to statements generated after saving. Existing statements keep the rate they were generated with.
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary text-sm px-6 py-2 inline-flex items-center gap-2"
          >
            {saving ? (
              <>
                <Spinner size="sm" />
                <span>Saving settings...</span>
              </>
            ) : (
              <span>Save settings</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
