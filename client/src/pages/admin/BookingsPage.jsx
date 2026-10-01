import { useState, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import { getAllBookings, approveBooking, rejectBooking } from '../../api/admin'
import { getVenues } from '../../api/venues'
import AdminLayout from '../../components/layout/AdminLayout'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { SkeletonRow } from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { formatCurrency, formatDate, formatTime } from '../../utils/format'
import { FunnelIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const PAGE_SIZE = 20
const BASE_URL = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')

export default function AdminBookingsPage() {
  const [filters, setFilters] = useState({ venueId: '', date: '', status: '', sortBy: 'priority' })
  const [page, setPage]       = useState(1)
  const [actionMessage, setActionMessage] = useState(null)
  const [actionError, setActionError]     = useState(null)

  // Review modal state
  const [reviewBooking, setReviewBooking] = useState(null)
  const [reviewMode, setReviewMode]       = useState('default') // 'default' | 'confirm-approve' | 'reject-form'
  const [rejectReason, setRejectReason]   = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [modalError, setModalError]       = useState(null)

  // Venues for filter dropdown
  const { data: venuesData } = useApi(useCallback(() => getVenues(), []))
  const venues = venuesData?.data ?? []

  // Bookings
  const fetchFn = useCallback(() => {
    const params = { sortBy: filters.sortBy || 'priority' }
    if (filters.venueId) params.venueId = filters.venueId
    if (filters.date)    params.date    = filters.date
    if (filters.status)  params.status  = filters.status
    return getAllBookings(params)
  }, [filters])

  const { data, loading, error, refetch } = useApi(fetchFn, [filters])
  const allBookings = data?.data ?? []
  const totalPages  = Math.ceil(allBookings.length / PAGE_SIZE)
  const bookings    = allBookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ venueId: '', date: '', status: '', sortBy: 'priority' })
    setPage(1)
  }

  const openReview = (b) => {
    setReviewBooking(b)
    setReviewMode('default')
    setRejectReason('')
    setModalError(null)
  }

  const closeReview = () => {
    if (actionLoading) return
    setReviewBooking(null)
    setReviewMode('default')
    setRejectReason('')
    setModalError(null)
  }

  const handleExecuteApprove = async () => {
    if (!reviewBooking) return
    setActionLoading(true)
    setModalError(null)
    try {
      await approveBooking(reviewBooking._id)
      setActionMessage('Booking approved successfully!')
      refetch()
      closeReview()
      window.dispatchEvent(new Event('pending-count-changed'))
      setTimeout(() => setActionMessage(null), 4000)
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to approve booking')
    } finally {
      setActionLoading(false)
    }
  }

  const handleExecuteReject = async () => {
    if (!reviewBooking) return
    const trimmed = rejectReason.trim()
    if (trimmed.length < 5) {
      setModalError('Rejection reason must be at least 5 characters.')
      return
    }
    setActionLoading(true)
    setModalError(null)
    try {
      await rejectBooking(reviewBooking._id, trimmed)
      setActionMessage('Booking rejected.')
      refetch()
      closeReview()
      window.dispatchEvent(new Event('pending-count-changed'))
      setTimeout(() => setActionMessage(null), 4000)
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to reject booking')
    } finally {
      setActionLoading(false)
    }
  }

  const hasFilters = filters.venueId || filters.date || filters.status || (filters.sortBy && filters.sortBy !== 'priority')

  return (
    <AdminLayout>
      <div className="page-container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="page-title">Bookings</h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Loading…' : `${allBookings.length} bookings total`}
            </p>
          </div>
          <button
            onClick={refetch}
            className="btn-secondary btn-sm"
            title="Refresh"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filters</span>
            {hasFilters && (
              <button onClick={clearFilters} className="ml-auto text-xs text-primary-600 hover:text-primary-700 font-medium">
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label text-xs" htmlFor="filter-venue">Venue</label>
              <select id="filter-venue" name="venueId" value={filters.venueId}
                      onChange={handleFilterChange} className="select text-sm">
                <option value="">All venues</option>
                {venues.map((v) => (
                  <option key={v._id} value={v._id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs" htmlFor="filter-date">Date</label>
              <input id="filter-date" name="date" type="date" value={filters.date}
                     onChange={handleFilterChange} className="input text-sm" />
            </div>
            <div>
              <label className="label text-xs" htmlFor="filter-status">Status</label>
              <select id="filter-status" name="status" value={filters.status}
                      onChange={handleFilterChange} className="select text-sm">
                <option value="">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="label text-xs" htmlFor="filter-sort">Sort by</label>
              <select id="filter-sort" name="sortBy" value={filters.sortBy}
                      onChange={handleFilterChange} className="select text-sm">
                <option value="priority">Priority (pending first)</option>
                <option value="recent">Recently updated</option>
                <option value="session">Session date (newest first)</option>
              </select>
            </div>
          </div>
        </div>

        <ErrorMessage message={error || actionError} className="mb-4" />

        {actionMessage && (
          <div className="flex items-center gap-3 p-4 bg-primary-50 border border-primary-200
                          rounded-xl text-sm text-primary-800 animate-fadeIn mb-4">
            <CheckCircleIcon className="h-5 w-5 text-primary-600 shrink-0" />
            {actionMessage}
          </div>
        )}

        <div className="table-wrapper">
          <div className="overflow-x-auto">
            <table className="table min-w-[850px]">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Venue</th>
                  <th>Court</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => <SkeletonRow key={n} cols={8} />)
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        icon="📋"
                        title="No bookings found"
                        description={hasFilters ? 'Try adjusting your filters.' : 'No bookings yet.'}
                        action={hasFilters
                          ? <button onClick={clearFilters} className="btn-secondary">Clear filters</button>
                          : null
                        }
                      />
                    </td>
                  </tr>
                ) : bookings.map((b) => (
                  <tr key={b._id}>
                    <td>
                      <p className="font-medium text-gray-900">{b.playerId?.fullName ?? '—'}</p>
                      <p className="text-xs text-gray-400">{b.playerId?.email ?? '—'}</p>
                    </td>
                    <td>
                      <p className="font-medium">{b.venueId?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{b.venueId?.area ?? '—'}</p>
                    </td>
                    <td className="text-center">#{b.courtId?.courtNumber ?? '—'}</td>
                    <td className="whitespace-nowrap text-xs">{formatDate(b.date)}</td>
                    <td className="whitespace-nowrap text-xs">
                      {formatTime(b.startTime)}–{formatTime(b.endTime)}
                    </td>
                    <td className="font-medium text-primary-700">{formatCurrency(b.amount)}</td>
                    <td className="uppercase text-xs text-gray-500">{b.paymentMethod}</td>
                    <td>
                      <Badge status={b.status} />
                      {b.autoConfirmed && (
                        <span className="mt-1.5 flex w-fit text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          Auto-confirmed
                        </span>
                      )}
                      {b.rescheduleCount > 0 && (
                        <span className="mt-1.5 flex w-fit text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          Rescheduled
                        </span>
                      )}
                      {b.status === 'pending' ? (
                        <div className="mt-2">
                          <button
                            onClick={() => openReview(b)}
                            className="btn-primary py-1 px-3 text-xs w-full"
                          >
                            Review
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <button
                            onClick={() => openReview(b)}
                            className="btn-secondary py-1 px-3 text-xs w-full"
                          >
                            View
                          </button>
                        </div>
                      )}
                      {b.status === 'rejected' && b.rejectionReason && (
                        <p className="text-[11px] text-gray-500 mt-1.5 max-w-[200px] leading-tight break-words">
                          <span className="font-medium text-gray-700">Reason:</span> {b.rejectionReason}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-gray-400">
                Page {page} of {totalPages} · {allBookings.length} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary btn-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={Boolean(reviewBooking)}
        onClose={closeReview}
        title={reviewBooking?.status === 'pending' ? 'Review Booking' : 'Booking Details'}
        size="lg"
      >
        {reviewBooking && (
          <div className="space-y-4">
            {/* Booking Summary */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-200/70">
                <div>
                  <p className="font-semibold text-gray-900">{reviewBooking.playerId?.fullName ?? '—'}</p>
                  <p className="text-xs text-gray-500">{reviewBooking.playerId?.email ?? '—'}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-base text-primary-600">
                    {formatCurrency(reviewBooking.amount)}
                  </span>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                    {reviewBooking.paymentMethod}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Venue & Court</span>
                  <span className="font-medium text-gray-800">
                    {reviewBooking.venueId?.name ?? '—'} · Court #{reviewBooking.courtId?.courtNumber ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Schedule</span>
                  <span className="font-medium text-gray-800">
                    {formatDate(reviewBooking.date)} ({formatTime(reviewBooking.startTime)}–{formatTime(reviewBooking.endTime)})
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Receipt Reference</span>
                  <span className="font-mono text-gray-700">
                    {reviewBooking.receiptId || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Status</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge status={reviewBooking.status} />
                    {reviewBooking.autoConfirmed && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        Auto-confirmed
                      </span>
                    )}
                  </div>
                </div>
                {reviewBooking.rescheduleCount > 0 && reviewBooking.rescheduledFrom && (
                  <div className="col-span-2">
                    <span className="text-gray-400 block mb-0.5">Rescheduled from</span>
                    <span className="font-medium text-gray-800">
                      {formatDate(reviewBooking.rescheduledFrom.date)},{' '}
                      {formatTime(reviewBooking.rescheduledFrom.startTime)}–{formatTime(reviewBooking.rescheduledFrom.endTime)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Image / Warning */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                Proof of Payment
              </label>
              {reviewBooking.receiptImage ? (
                <div className="bg-gray-100/70 border border-gray-200 rounded-xl p-2 flex flex-col items-center justify-center">
                  <a
                    href={`${BASE_URL}${reviewBooking.receiptImage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block cursor-zoom-in group text-center"
                    title="Click to view full size in new tab"
                  >
                    <img
                      src={`${BASE_URL}${reviewBooking.receiptImage}`}
                      alt="Proof of Payment Receipt"
                      className="max-h-[45vh] max-w-full object-contain rounded-lg shadow-sm mx-auto"
                    />
                    <span className="inline-block text-[11px] text-gray-500 mt-1.5 group-hover:text-primary-600 transition-colors">
                      Click to open full size in new tab ↗
                    </span>
                  </a>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-800 text-sm">
                  <ExclamationTriangleIcon className="h-6 w-6 text-amber-500 mx-auto mb-1" />
                  <p className="font-semibold">No receipt uploaded yet</p>
                  <p className="text-xs text-amber-700 mt-0.5">The player has not uploaded a payment receipt for this booking.</p>
                </div>
              )}
            </div>

            {/* Decision Section for non-pending bookings */}
            {reviewBooking.status !== 'pending' ? (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2.5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Decision
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge status={reviewBooking.status} />
                  {reviewBooking.autoConfirmed && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Auto-confirmed
                    </span>
                  )}
                  {reviewBooking.rescheduleCount > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      Rescheduled
                    </span>
                  )}
                </div>

                {reviewBooking.status === 'rejected' && reviewBooking.rejectionReason && (
                  <div className="pt-2 border-t border-gray-200/70 text-xs text-gray-700">
                    <span className="font-medium text-gray-900 block mb-1">Rejection Reason:</span>
                    <p className="text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200 text-xs">
                      {reviewBooking.rejectionReason}
                    </p>
                  </div>
                )}

                {reviewBooking.rescheduleCount > 0 && reviewBooking.rescheduledFrom && (
                  <div className="text-xs text-gray-600 pt-1">
                    <span className="font-medium text-gray-700">Rescheduled from: </span>
                    <span>
                      {formatDate(reviewBooking.rescheduledFrom.date)},{' '}
                      {formatTime(reviewBooking.rescheduledFrom.startTime)}–{formatTime(reviewBooking.rescheduledFrom.endTime)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Error Message inside modal */}
                {modalError && (
                  <ErrorMessage message={modalError} />
                )}

                {/* Action Section */}
                {reviewMode === 'default' && (
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setReviewMode('reject-form')}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewMode('confirm-approve')}
                      className="btn-primary px-4 py-2 text-sm bg-green-600 hover:bg-green-700 border-green-600"
                    >
                      Approve
                    </button>
                  </div>
                )}

                {/* Approve Confirmation Inline */}
                {reviewMode === 'confirm-approve' && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
                    <p className="text-sm font-medium text-green-900">
                      Are you sure you want to approve this booking?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setReviewMode('default')}
                        className="btn-secondary btn-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleExecuteApprove}
                        className="btn-primary btn-sm bg-green-600 hover:bg-green-700 border-green-600 text-white flex items-center gap-1.5"
                      >
                        {actionLoading && <Spinner size="sm" />}
                        Confirm approve
                      </button>
                    </div>
                  </div>
                )}

                {/* Reject Form with required reason */}
                {reviewMode === 'reject-form' && (
                  <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 space-y-3 animate-fadeIn">
                    <div>
                      <label htmlFor="rejection-reason" className="block text-xs font-semibold text-red-900 mb-1">
                        Reason for rejection <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="rejection-reason"
                        rows={3}
                        maxLength={300}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Enter reason for rejection (min 5 characters)..."
                        className="input text-sm w-full bg-white border-red-200 focus:border-red-500 focus:ring-red-500"
                      />
                      <div className="flex justify-between items-center text-[11px] text-gray-500 mt-1">
                        <span className={rejectReason.trim().length < 5 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                          {rejectReason.trim().length < 5
                            ? `Minimum 5 characters required (${rejectReason.trim().length}/5)`
                            : 'Reason requirement met'}
                        </span>
                        <span>{rejectReason.length}/300</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => { setReviewMode('default'); setRejectReason(''); setModalError(null); }}
                        className="btn-secondary btn-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading || rejectReason.trim().length < 5}
                        onClick={handleExecuteReject}
                        className="btn-danger btn-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {actionLoading && <Spinner size="sm" />}
                        Confirm reject
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
