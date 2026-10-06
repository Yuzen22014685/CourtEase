import { useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../hooks/useApi'
import { getAdminReviews, hideReview, restoreReview, getAdminVenues } from '../../api/admin'
import AdminLayout from '../../components/layout/AdminLayout'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { SkeletonRow } from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { formatDate, formatTime, formatDateTime } from '../../utils/format'
import {
  FunnelIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  EyeSlashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { StarIcon as StarOutline } from '@heroicons/react/24/outline'

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'visible', label: 'Visible' },
  { id: 'hidden', label: 'Hidden' },
]

export default function ReviewsPage() {
  const { isOwner } = useAuth()
  const [venueId, setVenueId] = useState('')
  const [statusTab, setStatusTab] = useState('')
  const [page, setPage] = useState(1)

  const [actionMessage, setActionMessage] = useState(null)
  const [actionError, setActionError] = useState(null)

  // Hide modal state
  const [hideTargetReview, setHideTargetReview] = useState(null)
  const [hideReason, setHideReason] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState(null)

  // Restore confirm dialog state
  const [restoreTargetReview, setRestoreTargetReview] = useState(null)
  const [restoreLoading, setRestoreLoading] = useState(false)

  // Venues for filter dropdown
  const { data: venuesData } = useApi(useCallback(() => getAdminVenues(), []))
  const venues = venuesData?.data ?? []

  // Fetch reviews (paginated 20 per page)
  const fetchReviews = useCallback(() => {
    const params = { page }
    if (venueId) params.venueId = venueId
    if (statusTab) params.status = statusTab
    return getAdminReviews(params)
  }, [page, venueId, statusTab])

  const { data, loading, error, refetch } = useApi(fetchReviews, [page, venueId, statusTab])

  const reviews = data?.data ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  const handleVenueChange = (e) => {
    setVenueId(e.target.value)
    setPage(1)
  }

  const handleTabChange = (tabId) => {
    setStatusTab(tabId)
    setPage(1)
  }

  const clearFilters = () => {
    setVenueId('')
    setStatusTab('')
    setPage(1)
  }

  const hasFilters = Boolean(venueId || statusTab)

  // Hide review flow
  const openHideModal = (review) => {
    setHideTargetReview(review)
    setHideReason('')
    setModalError(null)
  }

  const closeHideModal = () => {
    if (modalLoading) return
    setHideTargetReview(null)
    setHideReason('')
    setModalError(null)
  }

  const handleConfirmHide = async (e) => {
    e.preventDefault()
    if (!hideTargetReview) return

    const trimmed = hideReason.trim()
    if (trimmed.length < 5) {
      setModalError('Reason must be at least 5 characters long.')
      return
    }

    setModalLoading(true)
    setModalError(null)
    try {
      await hideReview(hideTargetReview._id, trimmed)
      setActionMessage('Review has been hidden and the player has been notified.')
      setActionError(null)
      closeHideModal()
      refetch()
      setTimeout(() => setActionMessage(null), 5000)
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to hide review.')
    } finally {
      setModalLoading(false)
    }
  }

  // Restore review flow
  const openRestoreConfirm = (review) => {
    setRestoreTargetReview(review)
  }

  const closeRestoreConfirm = () => {
    if (restoreLoading) return
    setRestoreTargetReview(null)
  }

  const handleConfirmRestore = async () => {
    if (!restoreTargetReview) return
    setRestoreLoading(true)
    try {
      await restoreReview(restoreTargetReview._id)
      setActionMessage('Review has been restored and is now visible on the venue page.')
      setActionError(null)
      closeRestoreConfirm()
      refetch()
      setTimeout(() => setActionMessage(null), 5000)
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to restore review.')
      closeRestoreConfirm()
      setTimeout(() => setActionError(null), 5000)
    } finally {
      setRestoreLoading(false)
    }
  }

  return (
    <AdminLayout
      title="Reviews"
      subtitle="Moderate player reviews and control their visibility across venues."
    >
      <div className="space-y-6">
        {/* Top filter bar */}
        <div className="card p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Status tabs */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
              {STATUS_TABS.map((tab) => {
                const isActive = statusTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Venue filter & clear */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-4 w-4 text-gray-400 shrink-0" />
                <select
                  id="filter-venue"
                  value={venueId}
                  onChange={handleVenueChange}
                  className="select text-xs py-1.5 w-48 sm:w-56"
                >
                  <option value="">All venues</option>
                  {venues.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="btn-secondary btn-sm text-xs py-1.5"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action feedback banners */}
        {actionMessage && (
          <div className="flex items-center gap-3 p-4 bg-primary-50 border border-primary-200 rounded-xl text-sm text-primary-800 animate-fadeIn">
            <CheckCircleIcon className="h-5 w-5 text-primary-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        <ErrorMessage message={error || actionError} />

        {/* Table Card */}
        <div className="table-wrapper">
          <div className="overflow-x-auto">
            <table className="table min-w-[950px]">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Reviewer</th>
                  <th>Rating &amp; Comment</th>
                  <th>Booking</th>
                  <th>Review Date</th>
                  <th>Status</th>
                  {!isOwner && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5, 6].map((n) => <SkeletonRow key={n} cols={isOwner ? 6 : 7} />)
                ) : reviews.length === 0 ? (
                  <tr>
                    <td colSpan={isOwner ? 6 : 7} className="py-12">
                      <EmptyState
                        icon="💬"
                        title="No reviews found"
                        description={
                          hasFilters
                            ? 'No reviews match your selected filters.'
                            : 'No customer reviews have been submitted yet.'
                        }
                        action={
                          hasFilters ? (
                            <button onClick={clearFilters} className="btn-secondary">
                              Clear filters
                            </button>
                          ) : null
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  reviews.map((r) => (
                    <tr key={r._id} className={r.isHidden ? 'bg-gray-50/50' : undefined}>
                      {/* Venue */}
                      <td>
                        <p className="font-medium text-gray-900">{r.venueId?.name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{r.venueId?.area ?? '—'}</p>
                      </td>

                      {/* Reviewer */}
                      <td>
                        <p className="font-medium text-gray-900">{r.playerId?.fullName ?? '—'}</p>
                        <p className="text-xs text-gray-400">{r.playerId?.email ?? '—'}</p>
                      </td>

                      {/* Rating & Comment */}
                      <td className="max-w-xs">
                        <div className="flex items-center gap-1 mb-1">
                          {[1, 2, 3, 4, 5].map((s) =>
                            s <= r.rating ? (
                              <StarSolid key={s} className="h-3.5 w-3.5 text-amber-400" />
                            ) : (
                              <StarOutline key={s} className="h-3.5 w-3.5 text-amber-300" />
                            )
                          )}
                          <span className="text-xs font-semibold text-gray-700 ml-1">
                            {r.rating}/5
                          </span>
                        </div>
                        {r.comment ? (
                          <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                            "{r.comment}"
                          </p>
                        ) : (
                          <p className="text-xs italic text-gray-400">No comment provided</p>
                        )}
                      </td>

                      {/* Booking Date & Time */}
                      <td className="whitespace-nowrap text-xs">
                        <p className="font-medium text-gray-800">
                          {r.bookingId?.date ? formatDate(r.bookingId.date) : '—'}
                        </p>
                        <p className="text-gray-400">
                          {r.bookingId?.startTime && r.bookingId?.endTime
                            ? `${formatTime(r.bookingId.startTime)}–${formatTime(r.bookingId.endTime)}`
                            : '—'}
                        </p>
                      </td>

                      {/* Review Date */}
                      <td className="whitespace-nowrap text-xs text-gray-600">
                        {formatDateTime(r.createdAt)}
                      </td>

                      {/* Status */}
                      <td>
                        <Badge
                          status={r.isHidden ? 'hidden' : 'visible'}
                          label={r.isHidden ? 'Hidden' : 'Visible'}
                        />
                        {r.isHidden && (
                          <div className="mt-1.5 max-w-[200px] space-y-0.5">
                            <p className="text-[11px] text-gray-600 leading-tight break-words">
                              <span className="font-medium text-gray-800">Reason:</span>{' '}
                              {r.hiddenReason}
                            </p>
                            {r.hiddenAt && (
                              <p className="text-[10px] text-gray-400">
                                Hidden {formatDateTime(r.hiddenAt)}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      {!isOwner && (
                        <td className="text-right whitespace-nowrap">
                          {r.isHidden ? (
                            <button
                              onClick={() => openRestoreConfirm(r)}
                              className="btn-secondary btn-sm text-primary-700 hover:text-primary-800 hover:bg-primary-50 text-xs py-1 px-2.5"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => openHideModal(r)}
                              className="btn-secondary btn-sm text-red-600 hover:text-red-700 hover:bg-red-50 text-xs py-1 px-2.5"
                            >
                              Hide
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-gray-500">
                Page {page} of {pages} · {total} reviews
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
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hide Review Modal */}
      <Modal
        isOpen={Boolean(hideTargetReview)}
        onClose={closeHideModal}
        title="Hide Review"
        size="md"
      >
        {hideTargetReview && (
          <form onSubmit={handleConfirmHide} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">
                  {hideTargetReview.playerId?.fullName}
                </span>
                <span className="text-amber-500 font-bold">
                  ★ {hideTargetReview.rating}/5
                </span>
              </div>
              <p className="text-gray-500">{hideTargetReview.venueId?.name}</p>
              {hideTargetReview.comment && (
                <p className="italic text-gray-700 line-clamp-2">
                  "{hideTargetReview.comment}"
                </p>
              )}
            </div>

            <div>
              <label htmlFor="hide-reason" className="label text-xs font-semibold text-gray-700 mb-1">
                Reason for hiding <span className="text-red-500">*</span>
              </label>
              <textarea
                id="hide-reason"
                rows={3}
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
                maxLength={300}
                placeholder="Explain why this review is being hidden (e.g. offensive language, personal information, spam)..."
                className="input text-xs w-full resize-none"
                autoFocus
              />
              <div className="flex justify-between items-center mt-1 text-[11px] text-gray-400">
                <span>{hideReason.trim().length < 5 ? 'Minimum 5 characters required' : 'Reason valid'}</span>
                <span>{hideReason.trim().length} / 300</span>
              </div>
            </div>

            {modalError && (
              <ErrorMessage message={modalError} className="text-xs" />
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={closeHideModal}
                disabled={modalLoading}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalLoading || hideReason.trim().length < 5}
                className="btn-danger btn-sm flex items-center gap-1.5"
              >
                {modalLoading ? (
                  <>
                    <Spinner size="sm" />
                    Hiding...
                  </>
                ) : (
                  <>
                    <EyeSlashIcon className="h-4 w-4" />
                    Hide Review
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(restoreTargetReview)}
        title="Restore Review"
        message={`Are you sure you want to restore the review for ${restoreTargetReview?.venueId?.name || 'this venue'} by ${restoreTargetReview?.playerId?.fullName || 'the customer'}? It will become visible on the public venue page again.`}
        confirmText={restoreLoading ? 'Restoring...' : 'Restore Review'}
        cancelText="Cancel"
        onConfirm={handleConfirmRestore}
        onCancel={closeRestoreConfirm}
        confirmVariant="primary"
      />
    </AdminLayout>
  )
}
