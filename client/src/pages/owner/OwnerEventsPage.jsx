import { useState, useEffect, useCallback, useRef } from 'react'
import { useOwnerVenue } from '../../context/OwnerVenueContext'
import {
  getOwnerVenueEvents,
  createVenueEvent,
  updateVenueEvent,
  deleteVenueEvent,
  uploadEventPoster,
  deleteEventPoster,
} from '../../api/admin'
import { formatDate, formatTime, getImageUrl, todayMY, addDaysISO } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CalendarDaysIcon,
  ClockIcon,
  PhotoIcon,
  CurrencyDollarIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

const initialFormState = {
  title: '',
  date: '',
  startTime: '19:00',
  endTime: '22:00',
  description: '',
  howToJoin: '',
  fee: '',
}

export default function OwnerEventsPage() {
  const { selectedVenue } = useOwnerVenue()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [editingEvent, setEditingEvent] = useState(null)
  const [formData, setFormData] = useState(initialFormState)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)

  // Poster management state
  const fileInputRef = useRef(null)
  const [posterFile, setPosterFile] = useState(null)
  const [posterPreview, setPosterPreview] = useState(null)
  const [removeExistingPoster, setRemoveExistingPoster] = useState(false)
  const [posterError, setPosterError] = useState(null)

  const [deletingEvent, setDeletingEvent] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchEvents = useCallback(async () => {
    if (!selectedVenue?._id) {
      setEvents([])
      setLoading(false)
      return
    }
    try {
      setPageError(null)
      const res = await getOwnerVenueEvents(selectedVenue._id)
      setEvents(res.data?.data || [])
      window.dispatchEvent(new Event('ce:owner-events-changed'))
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [selectedVenue?._id])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const cleanupBlobPreview = (url) => {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      cleanupBlobPreview(posterPreview)
    }
  }, [posterPreview])

  const handleOpenAdd = () => {
    cleanupBlobPreview(posterPreview)
    setModalMode('create')
    setEditingEvent(null)
    setFormData({
      title: '',
      date: todayMY(),
      startTime: '19:00',
      endTime: '22:00',
      description: '',
      howToJoin: '',
      fee: '',
    })
    setPosterFile(null)
    setPosterPreview(null)
    setRemoveExistingPoster(false)
    setPosterError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModalError(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (event) => {
    cleanupBlobPreview(posterPreview)
    setModalMode('edit')
    setEditingEvent(event)
    setFormData({
      title: event.title || '',
      date: event.date || '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      description: event.description || '',
      howToJoin: event.howToJoin || '',
      fee: event.fee || '',
    })
    setPosterFile(null)
    setPosterPreview(event.posterImage ? getImageUrl(event.posterImage) : null)
    setRemoveExistingPoster(false)
    setPosterError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setModalError(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (formSubmitting) return
    cleanupBlobPreview(posterPreview)
    setPosterFile(null)
    setPosterPreview(null)
    setRemoveExistingPoster(false)
    setPosterError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsModalOpen(false)
    setEditingEvent(null)
    setModalError(null)
  }

  const handlePosterSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPosterError(null)

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPosterError('Only JPG and PNG images are allowed.')
      e.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPosterError('Image exceeds the 5MB size limit.')
      e.target.value = ''
      return
    }

    cleanupBlobPreview(posterPreview)
    const newBlobUrl = URL.createObjectURL(file)
    setPosterFile(file)
    setPosterPreview(newBlobUrl)
    setRemoveExistingPoster(false)
  }

  const handleRemovePoster = () => {
    cleanupBlobPreview(posterPreview)
    setPosterFile(null)
    setPosterPreview(null)
    setPosterError(null)
    if (modalMode === 'edit' && editingEvent?.posterImage) {
      setRemoveExistingPoster(true)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!selectedVenue?._id) return

    setModalError(null)
    setPosterError(null)

    // Client checks
    if (!formData.title.trim()) {
      setModalError('Title is required')
      return
    }
    if (!formData.description.trim()) {
      setModalError('Description is required')
      return
    }
    if (!formData.date) {
      setModalError('Date is required')
      return
    }
    if (!formData.startTime || !formData.endTime) {
      setModalError('Start and end time are required')
      return
    }
    if (formData.endTime <= formData.startTime) {
      setModalError('End time must be after start time')
      return
    }

    setFormSubmitting(true)

    const payload = {
      title: formData.title.trim(),
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      description: formData.description.trim(),
      howToJoin: formData.howToJoin.trim(),
      fee: formData.fee.trim(),
    }

    try {
      if (modalMode === 'create') {
        // Step 1: Create event
        const res = await createVenueEvent(selectedVenue._id, payload)
        const newEvent = res.data?.data

        // Step 2: Upload poster if selected
        if (posterFile && newEvent?._id) {
          try {
            const fd = new FormData()
            fd.append('poster', posterFile)
            const uploadRes = await uploadEventPoster(selectedVenue._id, newEvent._id, fd)
            newEvent.posterImage =
              uploadRes.data?.data?.posterImage || uploadRes.data?.posterImage || newEvent.posterImage
          } catch (posterErr) {
            // Fallback: keep modal open in edit mode for newly created event
            await fetchEvents()
            setModalMode('edit')
            setEditingEvent(newEvent)
            setModalError(
              `Event saved, but the poster couldn't be uploaded: ${
                posterErr.response?.data?.message || posterErr.message || 'Upload failed'
              }. Try again or save without a poster.`
            )
            setFormSubmitting(false)
            return
          }
        }

        // Both succeeded
        handleCloseModal()
        await fetchEvents()
      } else if (modalMode === 'edit' && editingEvent) {
        // Step 1: Update details
        const res = await updateVenueEvent(selectedVenue._id, editingEvent._id, payload)
        const updatedEvent = res.data?.data || { ...editingEvent, ...payload }

        // Step 2: Handle poster upload / delete
        if (posterFile) {
          try {
            const fd = new FormData()
            fd.append('poster', posterFile)
            const uploadRes = await uploadEventPoster(selectedVenue._id, editingEvent._id, fd)
            updatedEvent.posterImage =
              uploadRes.data?.data?.posterImage || uploadRes.data?.posterImage || updatedEvent.posterImage
          } catch (posterErr) {
            setEditingEvent(updatedEvent)
            setModalError(
              posterErr.response?.data?.message || 'Failed to upload poster. Event details were saved.'
            )
            await fetchEvents()
            setFormSubmitting(false)
            return
          }
        } else if (removeExistingPoster) {
          try {
            await deleteEventPoster(selectedVenue._id, editingEvent._id)
            updatedEvent.posterImage = null
          } catch (posterErr) {
            setModalError(posterErr.response?.data?.message || 'Failed to remove poster.')
            await fetchEvents()
            setFormSubmitting(false)
            return
          }
        }

        handleCloseModal()
        await fetchEvents()
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save event')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingEvent || !selectedVenue?._id) return
    setIsDeleting(true)
    try {
      await deleteVenueEvent(selectedVenue._id, deletingEvent._id)
      setDeletingEvent(null)
      window.dispatchEvent(new Event('ce:owner-events-changed'))
      await fetchEvents()
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to delete event')
    } finally {
      setIsDeleting(false)
    }
  }

  const upcomingEvents = events.filter((e) => !e.isPast)
  const pastEvents = events.filter((e) => e.isPast)

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center items-center min-h-[300px]">
        <Spinner size="lg" />
      </div>
    )
  }

  const renderEventCard = (event, isPastSection = false) => {
    return (
      <div
        key={event._id}
        className={`card p-5 flex flex-col justify-between transition-all ${
          isPastSection
            ? 'opacity-85 bg-gray-50/70 border-gray-200'
            : 'hover:shadow-card-hover'
        }`}
      >
        <div className="space-y-3">
          {/* Card Top: Poster & Info */}
          <div className="flex items-start gap-3">
            {event.posterImage ? (
              <img
                src={getImageUrl(event.posterImage)}
                alt={event.title}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 border border-gray-100 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center shrink-0">
                <CalendarDaysIcon className="h-8 w-8 text-primary-500" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
                  {event.title}
                </h3>
                <div className="shrink-0">
                  {event.isHidden ? (
                    <Badge status="hidden" label="Hidden" />
                  ) : isPastSection ? (
                    <Badge status="expired" label="Past" />
                  ) : (
                    <Badge status="visible" label="Upcoming" />
                  )}
                </div>
              </div>

              {/* Date & Time */}
              <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                <div className="flex items-center gap-1.5 font-medium text-gray-800">
                  <CalendarDaysIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span>{formatDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span>
                    {formatTime(event.startTime)} – {formatTime(event.endTime)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {event.description ? (
            <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
              {event.description}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">No description provided.</p>
          )}

          {/* Fee & How to Join */}
          {(event.fee || event.howToJoin) && (
            <div className="pt-2.5 border-t border-gray-100 space-y-1 text-xs">
              {event.fee && (
                <div className="flex items-start gap-1.5 text-gray-600">
                  <CurrencyDollarIcon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-medium text-gray-700">Fee:</strong> {event.fee}
                  </span>
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

          {/* Hidden Warning Banner */}
          {event.isHidden && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
              <div className="flex items-start gap-1.5">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p>
                  Hidden by CourtEase admin: <span className="font-medium">{event.hiddenReason}</span>. Players can't see this event. Editing won't make it visible again — contact{' '}
                  <a
                    href="mailto:courtease.support@gmail.com"
                    className="underline font-medium hover:text-red-950"
                  >
                    courtease.support@gmail.com
                  </a>
                  , or remove it.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Card Bottom: Action buttons */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <div>
            {event.isHidden && (
              <span className="text-xs text-red-600 font-medium">Hidden from public</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Edit button: only for upcoming events */}
            {!isPastSection && (
              <button
                type="button"
                onClick={() => handleOpenEdit(event)}
                className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit event"
                aria-label={`Edit ${event.title}`}
              >
                <PencilSquareIcon className="h-4 w-4" />
              </button>
            )}

            {/* Delete button: works for both visible and hidden */}
            <button
              type="button"
              onClick={() => setDeletingEvent(event)}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title={event.isHidden ? 'Remove event' : 'Delete event'}
              aria-label={event.isHidden ? `Remove ${event.title}` : `Delete ${event.title}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Events</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
              {upcomingEvents.length} / 20 upcoming
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl leading-relaxed">
            Social nights, clinics, open play — shown on your venue page and the Events page.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          disabled={upcomingEvents.length >= 20}
          className="btn-primary self-start sm:self-auto"
          title={upcomingEvents.length >= 20 ? 'Maximum 20 upcoming events reached' : undefined}
        >
          <PlusIcon className="h-5 w-5" />
          <span>Add event</span>
        </button>
      </div>

      {pageError && (
        <ErrorMessage
          message={pageError}
          className="animate-fadeIn"
        />
      )}

      {/* ── Content ── */}
      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDaysIcon className="h-8 w-8 text-gray-400" />}
          title="No events yet"
          description="No events yet. Add your first event to let players know what's on."
          action={
            <button
              type="button"
              onClick={handleOpenAdd}
              className="btn-primary"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add event</span>
            </button>
          }
        />
      ) : (
        <div className="space-y-8">
          {/* Upcoming Events Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Upcoming Events</h2>
                <span className="text-xs text-gray-500 font-medium">({upcomingEvents.length})</span>
              </div>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                No upcoming events scheduled. Click "Add event" to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {upcomingEvents.map((e) => renderEventCard(e, false))}
              </div>
            )}
          </section>

          {/* Past Events Section */}
          {pastEvents.length > 0 && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-700">Past Events</h2>
                  <span className="text-xs text-gray-400 font-medium">({pastEvents.length})</span>
                </div>
                <span className="text-xs text-gray-400 italic">Read-only archive</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {pastEvents.map((e) => renderEventCard(e, true))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalMode === 'edit' ? 'Edit Event' : 'Add Event'}
        size="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1 py-0.5">
          {modalError && (
            <ErrorMessage
              message={modalError}
              className="animate-fadeIn"
            />
          )}

          {/* Poster Picker */}
          <div>
            <label className="label">
              Event Poster <span className="text-xs text-gray-400 font-normal">(optional, JPG/PNG up to 5MB)</span>
            </label>
            <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              {posterPreview ? (
                <div className="shrink-0">
                  <img
                    src={posterPreview}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200 shadow-sm"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-200/70 border border-dashed border-gray-300 flex items-center justify-center shrink-0 text-gray-400">
                  <PhotoIcon className="h-7 w-7" />
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-1.5">
                <input
                  ref={fileInputRef}
                  id="event-poster-file"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handlePosterSelect}
                  className="hidden"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={formSubmitting}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    {posterPreview ? 'Replace' : 'Upload poster'}
                  </button>
                  {posterPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePoster}
                      disabled={formSubmitting}
                      className="text-xs text-red-600 hover:text-red-700 py-1.5 px-2 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {posterError && (
                  <p className="text-xs text-red-500 font-medium">
                    {posterError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="event-title" className="label">
                Title <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-400">{formData.title.length}/80</span>
            </div>
            <input
              id="event-title"
              type="text"
              required
              maxLength={80}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Friday Social Badminton"
              className="input"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="event-date" className="label">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                id="event-date"
                type="date"
                required
                min={todayMY()}
                max={addDaysISO(todayMY(), 365)}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="event-start-time" className="label">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                id="event-start-time"
                type="time"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="event-end-time" className="label">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                id="event-end-time"
                type="time"
                required
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {/* Fee */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="event-fee" className="label">
                Fee
              </label>
              <span className="text-xs text-gray-400">{formData.fee.length}/60</span>
            </div>
            <input
              id="event-fee"
              type="text"
              maxLength={60}
              value={formData.fee}
              onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
              placeholder="e.g. Free or RM 15 per player"
              className="input"
            />
          </div>

          {/* How to join */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="event-howtojoin" className="label">
                How to join
              </label>
              <span className="text-xs text-gray-400">{formData.howToJoin.length}/300</span>
            </div>
            <textarea
              id="event-howtojoin"
              rows={2}
              maxLength={300}
              value={formData.howToJoin}
              onChange={(e) => setFormData({ ...formData, howToJoin: e.target.value })}
              placeholder="e.g. WhatsApp 012-345 6789 or walk in"
              className="input"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="event-description" className="label">
                Description <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-400">{formData.description.length}/1000</span>
            </div>
            <textarea
              id="event-description"
              required
              rows={4}
              maxLength={1000}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell players about skill level, format, what to bring, etc."
              className="input"
            />
          </div>

          {/* Form Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={formSubmitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="btn-primary"
            >
              {formSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{modalMode === 'edit' ? 'Save Changes' : 'Add Event'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Delete Dialog ── */}
      <ConfirmDialog
        isOpen={Boolean(deletingEvent)}
        title={
          deletingEvent?.isHidden
            ? 'Remove hidden event?'
            : deletingEvent
            ? `Delete "${deletingEvent.title}"?`
            : 'Delete Event'
        }
        message={
          deletingEvent?.isHidden
            ? 'This event was hidden by a CourtEase admin. It will disappear from your list, but CourtEase keeps a record of it.'
            : 'Delete this event? This cannot be undone.'
        }
        confirmText={
          isDeleting
            ? deletingEvent?.isHidden
              ? 'Removing...'
              : 'Deleting...'
            : deletingEvent?.isHidden
            ? 'Remove'
            : 'Delete'
        }
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeletingEvent(null)
        }}
      />
    </div>
  )
}

