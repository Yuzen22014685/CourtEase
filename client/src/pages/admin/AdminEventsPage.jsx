import { useState, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import {
  getAdminEvents,
  hideEvent,
  restoreEvent,
  getAdminVenues,
} from '../../api/admin'
import AdminLayout from '../../components/layout/AdminLayout'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import SkeletonCard from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import {
  formatDate,
  formatTime,
  formatDateTime,
  getImageUrl,
  pluralize,
} from '../../utils/format'
import {
  FunnelIcon,
  CheckCircleIcon,
  EyeSlashIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  CurrencyDollarIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'visible', label: 'Visible' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'review', label: 'Needs review' },
]

const WHEN_TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: '', label: 'All' },
]

export default function AdminEventsPage() {
  const [venueId, setVenueId] = useState('')
  const [statusTab, setStatusTab] = useState('')
  const [whenTab, setWhenTab] = useState('upcoming')
  const [page, setPage] = useState(1)

  const [actionMessage, setActionMessage] = useState(null)
  const [actionError, setActionError] = useState(null)

  // Hide modal state
  const [hideTargetEvent, setHideTargetEvent] = useState(null)
  const [hideReason, setHideReason] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState(null)

  // Restore confirm dialog state
  const [restoreTargetEvent, setRestoreTargetEvent] = useState(null)
  const [restoreLoading, setRestoreLoading] = useState(false)

  // Venues for filter dropdown
  const { data: venuesData } = useApi(useCallback(() => getAdminVenues(), []))
  const venues = venuesData?.data ?? []

  // Fetch events
  const fetchEvents = useCallback(() => {
    const params = { page }
    if (venueId) params.venueId = venueId
    if (statusTab) params.status = statusTab
    if (whenTab) params.when = whenTab
    return getAdminEvents(params)
  }, [page, venueId, statusTab, whenTab])

  const { data, loading, error, refetch } = useApi(fetchEvents, [
    page,
    venueId,
    statusTab,
    whenTab,
  ])

  const events = data?.data ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  const handleVenueChange = (e) => {
    setVenueId(e.target.value)
    setPage(1)
  }

  const handleStatusTabChange = (tabId) => {
    setStatusTab(tabId)
    setPage(1)
  }

  const handleWhenTabChange = (tabId) => {
    setWhenTab(tabId)
    setPage(1)
  }

  const clearFilters = () => {
    setVenueId('')
    setStatusTab('')
    setWhenTab('upcoming')
    setPage(1)
  }

  const hasFilters = Boolean(venueId || statusTab || whenTab !== 'upcoming')

  // Hide event flow
  const openHideModal = (event) => {
    setHideTargetEvent(event)
    setHideReason('')
    setModalError(null)
  }

  const closeHideModal = () => {
    if (modalLoading) return
    setHideTargetEvent(null)
    setHideReason('')
    setModalError(null)
  }

  const handleConfirmHide = async (e) => {
    e.preventDefault()
    if (!hideTargetEvent) return

    const trimmed = hideReason.trim()
    if (trimmed.length < 5) {
      setModalError('Please give a reason of at least 5 characters')
      return
    }

    setModalLoading(true)
    setModalError(null)
    try {
      await hideEvent(hideTargetEvent._id, trimmed)
      setActionMessage(hideTargetEvent.isHidden ? 'Event has been hidden again.' : 'Event has been hidden.')
      setActionError(null)
      closeHideModal()
      window.dispatchEvent(new Event('ce:admin-events-changed'))
      refetch()
      setTimeout(() => setActionMessage(null), 5000)
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to hide event.')
    } finally {
      setModalLoading(false)
    }
  }

  // Restore event flow
  const openRestoreConfirm = (event) => {
    setRestoreTargetEvent(event)
  }

  const closeRestoreConfirm = () => {
    if (restoreLoading) return
    setRestoreTargetEvent(null)
  }

  const handleConfirmRestore = async () => {
    if (!restoreTargetEvent) return
    setRestoreLoading(true)
    try {
      await restoreEvent(restoreTargetEvent._id)
      setActionMessage('Event has been restored and is visible to players.')
      setActionError(null)
      closeRestoreConfirm()
      window.dispatchEvent(new Event('ce:admin-events-changed'))
      refetch()
      setTimeout(() => setActionMessage(null), 5000)
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to restore event.')
      closeRestoreConfirm()
      setTimeout(() => setActionError(null), 5000)
    } finally {
      setRestoreLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="page-container space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="page-title">Events</h1>
            <p className="text-sm text-gray-500 mt-1">
              Events posted by venue owners. Hide anything misleading or inappropriate — owners see your reason.
            </p>
          </div>
          <button
            type="button"
            onClick={refetch}
            className="btn-secondary btn-sm"
            title="Refresh"
            aria-label="Refresh events"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="card p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Tabs */}
                <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
                  {STATUS_TABS.map((tab) => {
                    const isActive = statusTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleStatusTabChange(tab.id)}
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

                {/* When Tabs */}
                <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
                  {WHEN_TABS.map((tab) => {
                    const isActive = whenTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleWhenTabChange(tab.id)}
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
              </div>

              {/* Venue Filter & Clear */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <FunnelIcon className="h-4 w-4 text-gray-400 shrink-0" />
                  <select
                    id="filter-venue"
                    value={venueId}
                    onChange={handleVenueChange}
                    className="select text-xs py-1.5 w-48 sm:w-56"
                    aria-label="Filter by venue"
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
                    type="button"
                    onClick={clearFilters}
                    className="btn-secondary btn-sm text-xs py-1.5"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Feedback Banners */}
          {actionMessage && (
            <div className="flex items-center gap-3 p-4 bg-primary-50 border border-primary-200 rounded-xl text-sm text-primary-800 animate-fadeIn">
              <CheckCircleIcon className="h-5 w-5 text-primary-600 shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          <ErrorMessage message={error || actionError} />

          {/* Cards Content */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SkeletonCard key={n} />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="card py-8">
              <EmptyState
                icon="📅"
                title="No events found"
                description={
                  hasFilters
                    ? 'No events match these filters.'
                    : 'No events have been posted yet.'
                }
                action={
                  hasFilters ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="btn-secondary"
                    >
                      Clear filters
                    </button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {events.map((event) => (
                <div
                  key={event._id}
                  className={`card p-5 flex flex-col justify-between transition-all ${
                    event.isPast
                      ? 'opacity-85 bg-gray-50/70 border-gray-200'
                      : 'hover:shadow-card-hover'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Top: Poster & Info */}
                    <div className="flex items-start gap-3">
                      {event.posterImage ? (
                        <img
                          src={getImageUrl(event.posterImage)}
                          alt={event.title}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 border border-gray-100 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gray-100 text-gray-500 border border-gray-200 flex items-center justify-center shrink-0">
                          <CalendarDaysIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
                            {event.title}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                          {event.venueId?.name || '—'}{' '}
                          {event.venueId?.area ? `· ${event.venueId.area}` : ''}
                        </p>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {event.deletedByOwnerAt && (
                            <Badge status="inactive" label="Deleted by owner" />
                          )}
                          {event.isHidden ? (
                            <Badge status="rejected" label="Hidden" />
                          ) : !event.deletedByOwnerAt ? (
                            <Badge status="visible" label="Visible" />
                          ) : null}
                          {event.isHidden && event.ownerUpdatedAt && !event.deletedByOwnerAt && (
                            <Badge status="pending" label="Updated by owner" />
                          )}
                          {event.isPast && <Badge status="expired" label="Past" />}
                        </div>
                        {event.deletedByOwnerAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Removed by the owner on {formatDateTime(event.deletedByOwnerAt)}
                          </p>
                        )}
                        {event.isHidden && event.ownerUpdatedAt && !event.deletedByOwnerAt && (
                          <p className="text-xs text-amber-700 mt-1">
                            Owner updated it on {formatDateTime(event.ownerUpdatedAt)} — check it, then Restore or hide again with a new reason.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Date, Time & Posted By */}
                    <div className="space-y-1 text-xs text-gray-600 bg-gray-50/70 p-2.5 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-1.5 font-medium text-gray-800">
                        <CalendarDaysIcon className="h-4 w-4 text-gray-400 shrink-0" />
                        <span>{formatDate(event.date)}</span>
                        <span className="text-gray-300">·</span>
                        <ClockIcon className="h-4 w-4 text-gray-400 shrink-0" />
                        <span>
                          {formatTime(event.startTime)} – {formatTime(event.endTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <UserIcon className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="truncate">
                          Posted by{' '}
                          <strong className="font-medium text-gray-700">
                            {event.createdBy?.fullName || 'Venue Owner'}
                          </strong>
                          {event.createdBy?.email ? ` (${event.createdBy.email})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Description clamped to 3 lines */}
                    {event.description ? (
                      <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                        {event.description}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No description provided.</p>
                    )}

                    {/* Fee & How to Join */}
                    {(event.fee || event.howToJoin) && (
                      <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs">
                        {event.fee && (
                          <div className="flex items-start gap-1.5 text-gray-600">
                            <CurrencyDollarIcon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <strong className="font-medium text-gray-700">Fee:</strong>{' '}
                              <span>{event.fee}</span>
                            </div>
                          </div>
                        )}
                        {event.howToJoin && (
                          <div className="flex items-start gap-1.5 text-gray-600">
                            <InformationCircleIcon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1 whitespace-pre-line break-words">
                              <strong className="font-medium text-gray-700">How to join:</strong>{' '}
                              <span>{event.howToJoin}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* If Hidden: Red Box */}
                    {event.isHidden && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                        <p className="font-semibold break-words">
                          Hidden: {event.hiddenReason}
                        </p>
                        <p className="text-[11px] text-red-600">
                          by {event.hiddenBy?.fullName || 'Admin'}
                          {event.hiddenAt ? ` · ${formatDateTime(event.hiddenAt)}` : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!event.deletedByOwnerAt && (
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                      {event.isHidden ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openHideModal(event)}
                            className="btn-secondary btn-sm text-red-600 hover:text-red-700 hover:bg-red-50 text-xs py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <EyeSlashIcon className="h-3.5 w-3.5" />
                            <span>Hide again</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openRestoreConfirm(event)}
                            className="btn-secondary btn-sm text-primary-700 hover:text-primary-800 hover:bg-primary-50 text-xs py-1.5 px-3"
                          >
                            Restore
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openHideModal(event)}
                          className="btn-secondary btn-sm text-red-600 hover:text-red-700 hover:bg-red-50 text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <EyeSlashIcon className="h-3.5 w-3.5" />
                          <span>Hide</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-gray-500">
                Page {page} of {pages} · {pluralize(total, 'event')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary btn-sm"
                >
                  Previous
                </button>
                <button
                  type="button"
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

        {/* Hide Event Modal */}
        <Modal
          isOpen={Boolean(hideTargetEvent)}
          onClose={closeHideModal}
          title={hideTargetEvent?.isHidden ? 'Hide again' : 'Hide event'}
          size="md"
        >
          {hideTargetEvent && (
            <form onSubmit={handleConfirmHide} className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 text-xs text-gray-600">
                <div className="font-semibold text-gray-900 text-sm">
                  {hideTargetEvent.title}
                </div>
                <p className="text-gray-500">
                  {hideTargetEvent.venueId?.name || '—'}
                  {hideTargetEvent.venueId?.area ? ` · ${hideTargetEvent.venueId.area}` : ''}
                </p>
                <p className="text-gray-500">
                  {formatDate(hideTargetEvent.date)} ({formatTime(hideTargetEvent.startTime)} – {formatTime(hideTargetEvent.endTime)})
                </p>
              </div>

              <div>
                <label htmlFor="hide-reason" className="label text-xs font-semibold text-gray-700 mb-1">
                  Reason for hiding <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="hide-reason"
                  rows={3}
                  value={hideReason}
                  onChange={(e) => {
                    setHideReason(e.target.value)
                    if (modalError) setModalError(null)
                  }}
                  maxLength={300}
                  placeholder="Explain why — the owner will see this"
                  className="input text-xs w-full resize-none"
                  autoFocus
                />
                <div className="flex justify-between items-center mt-1 text-[11px] text-gray-400">
                  <span>
                    {hideReason.trim().length < 5
                      ? 'Please give a reason of at least 5 characters'
                      : 'Reason valid'}
                  </span>
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
                      <span>{hideTargetEvent?.isHidden ? 'Hiding again...' : 'Hiding...'}</span>
                    </>
                  ) : (
                    <>
                      <EyeSlashIcon className="h-4 w-4" />
                      <span>{hideTargetEvent?.isHidden ? 'Hide again' : 'Hide event'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* Restore Confirmation Dialog */}
        <ConfirmDialog
          isOpen={Boolean(restoreTargetEvent)}
          title="Restore this event?"
          message="Restore this event? It will be visible to players again."
          confirmText={restoreLoading ? 'Restoring...' : 'Restore'}
          cancelText="Cancel"
          onConfirm={handleConfirmRestore}
          onCancel={closeRestoreConfirm}
          confirmVariant="primary"
        />
      </div>
    </AdminLayout>
  )
}

