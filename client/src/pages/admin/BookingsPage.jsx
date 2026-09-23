import { useState, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import { getAllBookings, approveBooking, rejectBooking } from '../../api/admin'
import { getVenues } from '../../api/venues'
import AdminLayout from '../../components/layout/AdminLayout'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { SkeletonRow } from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { formatCurrency, formatDate, formatTime } from '../../utils/format'
import { FunnelIcon, ArrowPathIcon, CheckCircleIcon, PhotoIcon } from '@heroicons/react/24/outline'

const PAGE_SIZE = 20
const BASE_URL = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')

export default function AdminBookingsPage() {
  const [filters, setFilters] = useState({ venueId: '', date: '', status: '' })
  const [page, setPage]       = useState(1)
  const [actionMessage, setActionMessage] = useState(null)
  const [actionError, setActionError]     = useState(null)
  const [confirmState, setConfirmState] = useState({ isOpen: false, type: null, id: null })
  const [receiptViewer, setReceiptViewer] = useState({ isOpen: false, imageUrl: null })

  // Venues for filter dropdown
  const { data: venuesData } = useApi(useCallback(() => getVenues(), []))
  const venues = venuesData?.data ?? []

  // Bookings
  const fetchFn = useCallback(() => {
    const params = {}
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
    setFilters({ venueId: '', date: '', status: '' })
    setPage(1)
  }

  const handleApproveClick = (id) => setConfirmState({ isOpen: true, type: 'approve', id })
  const handleRejectClick = (id) => setConfirmState({ isOpen: true, type: 'reject', id })

  const executeApprove = async (id) => {
    setActionError(null)
    setActionMessage(null)
    try {
      await approveBooking(id)
      setActionMessage('Booking approved successfully!')
      refetch()
      setTimeout(() => setActionMessage(null), 4000)
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve booking')
    }
  }

  const executeReject = async (id) => {
    setActionError(null)
    setActionMessage(null)
    try {
      await rejectBooking(id)
      setActionMessage('Booking rejected and refunded successfully!')
      refetch()
      setTimeout(() => setActionMessage(null), 4000)
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reject booking')
    }
  }

  const handleConfirm = () => {
    const { type, id } = confirmState
    setConfirmState({ isOpen: false, type: null, id: null })
    if (type === 'approve') executeApprove(id)
    if (type === 'reject') executeReject(id)
  }

  const hasFilters = filters.venueId || filters.date || filters.status

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <table className="table">
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
                      {b.status === 'pending' && (
                        <div className="flex flex-col gap-1.5 mt-2">
                          <button
                            onClick={() => handleApproveClick(b._id)}
                            className="btn-primary py-1 px-2 text-xs w-full"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectClick(b._id)}
                            className="btn-secondary py-1 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 w-full"
                          >
                            Reject
                          </button>
                          {b.receiptImage ? (
                            <button
                              onClick={() => setReceiptViewer({ isOpen: true, imageUrl: `${BASE_URL}${b.receiptImage}` })}
                              className="btn-secondary py-1 px-2 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 w-full flex items-center justify-center gap-1 mt-1"
                            >
                              <PhotoIcon className="h-3 w-3" />
                              View Receipt
                            </button>
                          ) : (
                            <div className="text-[10px] text-gray-500 text-center italic mt-1 leading-tight px-1">
                              No receipt uploaded yet
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
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

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.type === 'approve' ? 'Approve Booking' : 'Reject Booking'}
        message={
          confirmState.type === 'approve'
            ? 'Are you sure you want to approve this booking?'
            : 'Are you sure you want to reject this booking? The payment will be refunded.'
        }
        confirmText={confirmState.type === 'approve' ? 'Approve' : 'Reject & Refund'}
        cancelText="Cancel"
        confirmVariant={confirmState.type === 'approve' ? 'primary' : 'danger'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState({ isOpen: false, type: null, id: null })}
      />

      <Modal
        isOpen={receiptViewer.isOpen}
        onClose={() => setReceiptViewer({ isOpen: false, imageUrl: null })}
        title="Payment Receipt"
        size="md"
      >
        <div className="flex justify-center p-2 bg-gray-50 rounded-xl">
          {receiptViewer.imageUrl && (
            <img 
              src={receiptViewer.imageUrl} 
              alt="Payment Receipt" 
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
            />
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}
