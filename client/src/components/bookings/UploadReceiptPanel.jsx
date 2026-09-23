import { useState } from 'react'
import { uploadReceipt } from '../../api/bookings'
import { ArrowUpTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import Spinner from '../ui/Spinner'
import ErrorMessage from '../ui/ErrorMessage'

export default function UploadReceiptPanel({ bookingIds, onSuccess }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a receipt image.')
      return
    }
    setUploading(true)
    setError(null)

    try {
      for (const id of bookingIds) {
        const formData = new FormData()
        formData.append('receipt', file)
        await uploadReceipt(id, formData)
      }
      setUploading(false)
      onSuccess()
    } catch (err) {
      console.error(err)
      setUploading(false)
      setError(err.response?.data?.message || 'Failed to upload receipt. Please try again.')
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1 flex items-center gap-1.5">
          <ExclamationTriangleIcon className="h-4 w-4" />
          Required for verification
        </p>
        <p>Please upload a screenshot or photo of your payment receipt. This is required for admin approval.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Image (JPEG/PNG)</label>
          <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-primary-500 transition-colors bg-gray-50">
            <div className="space-y-2 text-center">
              <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400" />
              <div className="flex text-sm text-gray-600 justify-center">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none"
                >
                  <span>{file ? file.name : 'Upload a file'}</span>
                  <input id="file-upload" name="file-upload" type="file" accept="image/jpeg, image/png" className="sr-only" onChange={handleFileChange} disabled={uploading} />
                </label>
                {!file && <p className="pl-1">or drag and drop</p>}
              </div>
              <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
            </div>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        <button type="submit" disabled={!file || uploading} className="btn-primary w-full">
          {uploading ? <><Spinner size="sm" /> Uploading...</> : 'Submit Receipt'}
        </button>
      </form>
    </div>
  )
}
