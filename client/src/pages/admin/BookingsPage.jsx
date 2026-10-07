import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOwnerVenue } from '../../context/OwnerVenueContext'
import { useApi } from '../../hooks/useApi'
import { getAllBookings, approveBooking, rejectBooking, getAdminVenues } from '../../api/admin'
import AdminLayout from '../../components/layout/AdminLayout'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { SkeletonRow } from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { formatCurrency, formatDate, formatTime, todayString, formatPaymentMethod, formatPaymentRef } from '../../utils/format'
import { FunnelIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const BASE_URL = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')

export default function AdminBookingsPage({ noLayout = false }) {
  const { isOwner } = useAuth()
  const { selectedVenue } = useOwnerVenue()
  const [filters, setFilters] = useState({ venueId: '', date: '', status: '', sortBy: 'priority' })
  const [activeChip, setActiveChip] = useState('all')
  const [visibleCount, setVisibleCount] = useState(20)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState(null)

  // Review modal state
  const [reviewBooking, setReviewBooking] = useState(null)
  const [reviewMode, setReviewMode]       = useState('default') // 'default' | 'confirm-approve' | 'reject-form'
  const [rejectReason, setRejectReason]   = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [modalError, setModalError]       = useState(null)

  // Venues for filter dropdown
  const { data: venuesData } = useApi(useCallback(() => getAdminVenues(), []))
  const venues = venuesData?.data ?? []

  // Active venue ID: owner's selected venue or admin's chosen filter
  const activeVenueId = isOwner && selectedVenue?._id ? selectedVenue._id : filters.venueId

  // Bookings
  const fetchFn = useCallback(() => {
    const params = { sortBy: filters.sortBy || 'priority' }
    if (activeVenueId)   params.venueId = activeVenueId
    if (filters.date)    params.date    = filters.date
    if (filters.status)  params.status  = filters.status
    return getAllBookings(params)
  }, [filters, activeVenueId])

  const { data, loading, error, refetch } = useApi(fetchFn, [filters, activeVenueId])
  const allBookings = data?.data ?? []

  // Quick filter chips & local date logic
  const today = todayString()

  const needsReviewCount = useMemo(() => {
    return allBookings.filter((b) => b.status === 'pending').length
  }, [allBookings])

  const sharedOtherBookingsCount = useMemo(() => {
    if (!reviewBooking?.paymentRef) return 0
    return allBookings.filter(
      (b) => b._id !== reviewBooking._id && b.paymentRef === reviewBooking.paymentRef
    ).length
  }, [reviewBooking, allBookings])

  const filteredBookings = useMemo(() => {
    if (activeChip === 'needs-review') {
      return allBookings.filter((b) => b.status === 'pending')
    }
    if (activeChip === 'upcoming') {
      return allBookings.filter(
        (b) => (b.status === 'pending' || b.status === 'confirmed') && b.date >= today
      )
    }
    if (activeChip === 'past') {
      return allBookings.filter(
        (b) =>
          ['completed', 'cancelled', 'rejected', 'expired'].includes(b.status) ||
          b.date < today
      )
    }
    return allBookings
  }, [allBookings, activeChip, today])

  const bookings = filteredBookings.slice(0, visibleCount)
  const remainingCount = Math.max(0, filteredBookings.length - visibleCount)

  const chips = [
    { id: 'all', label: 'All' },
    { id: 'needs-review', label: `Needs review (${needsReviewCount})` },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
  ]

  const handleChipChange = (chipId) => {
    setActiveChip(chipId)
    setVisibleCount(20)
  }

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setVisibleCount(20)
  }

  const clearFilters = () => {
    setFilters({ venueId: '', date: '', status: '', sortBy: 'priority' })
    setVisibleCount(20)
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

  const [searchParams, setSearchParams] = useSearchParams()

  // Deep link support (?review=<bookingId>)
  useEffect(() => {
    const reviewId = searchParams.get('review')
    if (reviewId && allBookings.length > 0) {
      const match = allBookings.find((b) => b._id === reviewId)
      if (match) {
        openReview(match)
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('review')
        setSearchParams(nextParams, { replace: true })
      }
    }
  }, [searchParams, allBookings, setSearchParams])

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

  const activeFilterCount = [
    !isOwner && Boolean(filters.venueId),
    Boolean(filters.date),
    Boolean(filters.status),
    Boolean(filters.sortBy && filters.sortBy !== 'priority'),
  ].filter(Boolean).length

  const hasFilters = activeFilterCount > 0

  const content = (
    <>
      <div className="page-container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Bookings</h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Loading…' : `${filteredBookings.length} bookings total`}
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
        <div className="card p-4 mb-4">
          {/* Mobile toggle button (<md) */}
          <div className="flex items-center justify-between md:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700"
            >
              <FunnelIcon className="h-4 w-4 text-gray-500" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[11px] font-bold bg-primary-100 text-primary-700 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Desktop header (md+) */}
          <div className="hidden md:flex items-center gap-2 mb-3">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filters</span>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Filter inputs container */}
          <div className={filtersOpen ? 'block mt-3 md:mt-0' : 'hidden md:block'}>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${isOwner ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3`}>
              {!isOwner && (
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
              )}
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
        </div>

        {/* Quick Filter Chips (all screen widths) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleChipChange(chip.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeChip === chip.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <ErrorMessage message={error} className="mb-4" />

        {actionMessage && (
          <div className="flex items-center gap-3 p-4 bg-primary-50 border border-primary-200
                          rounded-xl text-sm text-primary-800 animate-fadeIn mb-4">
            <CheckCircleIcon className="h-5 w-5 text-primary-600 shrink-0" />
            {actionMessage}
          </div>
        )}

        {/* ── Mobile Cards (<md) ── */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            [1, 2, 3].map((n) => (
              <div key={n} className="card p-4 animate-pulse space-y-3 bg-white border border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-8 bg-gray-200 rounded w-full" />
              </div>
            ))
          ) : bookings.length === 0 ? (
            <div className="card p-8 text-center bg-white border border-gray-200">
              <EmptyState
                icon="📋"
                title="No bookings found"
                description={hasFilters || activeChip !== 'all' ? 'Try adjusting your filters.' : 'No bookings yet.'}
                action={
                  hasFilters || activeChip !== 'all' ? (
                    <button
                      onClick={() => {
                        clearFilters()
                        setActiveChip('all')
                      }}
                      className="btn-secondary"
                    >
                      Clear filters
                    </button>
                  ) : null
                }
              />
            </div>
          ) : (
            bookings.map((b) => (
              <div
                key={b._id}
                className="card p-4 bg-white border border-gray-200 shadow-sm flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">
                        {b.playerId?.fullName ?? '—'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {b.playerId?.email ?? '—'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge status={b.status} />
                      {b.autoConfirmed && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          Auto-confirmed
                        </span>
                      )}
                      {b.rescheduleCount > 0 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          Rescheduled
                        </span>
                      )}
                    </div>
                  </div>

                  {!isOwner && b.venueId && (
                    <p className="text-xs font-medium text-gray-700 mt-2">
                      {b.venueId.name} {b.venueId.area ? `· ${b.venueId.area}` : ''}
                    </p>
                  )}

                  <p className="text-xs text-gray-600 mt-1">
                    Court #{b.courtId?.courtNumber ?? '—'} · {formatDate(b.date)} · {formatTime(b.startTime)}–{formatTime(b.endTime)}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="font-bold text-primary-700">{formatCurrency(b.amount)}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-600 font-medium">{formatPaymentMethod(b.paymentMethod)}</span>
                  </div>

                  {b.status === 'rejected' && b.rejectionReason && (
                    <p className="text-[11px] text-gray-500 mt-2 bg-gray-50 p-2 rounded border border-gray-100 leading-snug">
                      <span className="font-medium text-gray-700">Reason:</span> {b.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => openReview(b)}
                    className={`w-full py-2 text-xs font-medium rounded-lg ${
                      b.status === 'pending' ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {b.status === 'pending' ? 'Review' : 'View'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Desktop Table (md+) ── */}
        <div className="hidden md:block">
          <div className="table-wrapper">
            <div className="overflow-x-auto">
              <table className="table min-w-[850px]">
                <thead>
                  <tr>
                    <th>Customer</th>
                    {!isOwner && <th>Venue</th>}
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
                    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => <SkeletonRow key={n} cols={isOwner ? 7 : 8} />)
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan={isOwner ? 7 : 8} className="py-12">
                        <EmptyState
                          icon="📋"
                          title="No bookings found"
                          description={hasFilters || activeChip !== 'all' ? 'Try adjusting your filters.' : 'No bookings yet.'}
                          action={
                            hasFilters || activeChip !== 'all' ? (
                              <button
                                onClick={() => {
                                  clearFilters()
                                  setActiveChip('all')
                                }}
                                className="btn-secondary"
                              >
                                Clear filters
                              </button>
                            ) : null
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b) => (
                      <tr key={b._id}>
                        <td>
                          <p className="font-medium text-gray-900">{b.playerId?.fullName ?? '—'}</p>
                          <p className="text-xs text-gray-400">{b.playerId?.email ?? '—'}</p>
                        </td>
                        {!isOwner && (
                          <td>
                            <p className="font-medium">{b.venueId?.name ?? '—'}</p>
                            <p className="text-xs text-gray-400">{b.venueId?.area ?? '—'}</p>
                          </td>
                        )}
                        <td className="text-center">#{b.courtId?.courtNumber ?? '—'}</td>
                        <td className="whitespace-nowrap text-xs">{formatDate(b.date)}</td>
                        <td className="whitespace-nowrap text-xs">
                          {formatTime(b.startTime)}–{formatTime(b.endTime)}
                        </td>
                        <td className="font-medium text-primary-700">{formatCurrency(b.amount)}</td>
                        <td className="text-xs text-gray-700 font-medium">{formatPaymentMethod(b.paymentMethod)}</td>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Show More Pagination Button ── */}
        {remainingCount > 0 && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 20)}
              className="btn-secondary text-xs px-5 py-2.5 font-semibold"
            >
              Show more ({remainingCount} left)
            </button>
          </div>
        )}
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
                  <p className="text-[11px] text-gray-500 font-medium">
                    {formatPaymentMethod(reviewBooking.paymentMethod)}
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
                  <span className="text-gray-400 block mb-0.5">Payment Status</span>
                  <Badge
                    status={reviewBooking.paymentStatus}
                    label={reviewBooking.paymentStatus === 'pending' ? 'Awaiting payment' : undefined}
                  />
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

            {/* Payment Reference Highlighted Row */}
            <div className="bg-primary-50/70 border border-primary-200 rounded-xl p-3.5 space-y-1.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-gray-900">Payment reference:</span>
                  <span className="font-mono font-bold text-sm text-primary-700 select-all tracking-wider">
                    {formatPaymentRef(reviewBooking)}
                  </span>
                </div>
                <div className="text-gray-700">
                  <span className="text-gray-500">Paid by: </span>
                  <span className="font-medium text-gray-900">{formatPaymentMethod(reviewBooking.paymentMethod)}</span>
                </div>
              </div>

              <p className="text-gray-500 text-[11px]">
                Match this with the transfer note on the receipt.
              </p>

              {sharedOtherBookingsCount > 0 && (
                <p className="text-primary-800 font-medium text-[11px] pt-1 border-t border-primary-200/60">
                  Paid together with {sharedOtherBookingsCount} other booking(s) — one transfer, one receipt.
                </p>
              )}
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
    </>
  )

  if (noLayout) return content
  return <AdminLayout>{content}</AdminLayout>
}
