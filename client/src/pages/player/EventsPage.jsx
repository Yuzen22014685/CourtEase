import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { getPublicEvents } from '../../api/venues'
import Layout from '../../components/layout/Layout'
import SkeletonCard from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import ImageLightbox from '../../components/ui/ImageLightbox'
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import { formatDate, formatTime, getImageUrl } from '../../utils/format'

export default function EventsPage() {
  const [selectedArea, setSelectedArea] = useState('')
  const [activePoster, setActivePoster] = useState(null)

  const fetchFn = useCallback(() => getPublicEvents(), [])
  const { data, loading, error, refetch } = useApi(fetchFn, [])

  const allEvents = useMemo(() => data?.data ?? [], [data])

  // Extract unique areas from loaded events
  const availableAreas = useMemo(() => {
    return Array.from(new Set(allEvents.map((e) => e.venue?.area).filter(Boolean))).sort()
  }, [allEvents])

  // Filter events by selected area
  const events = useMemo(() => {
    if (!selectedArea) return allEvents
    return allEvents.filter((e) => e.venue?.area === selectedArea)
  }, [allEvents, selectedArea])

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary-600 text-sm font-medium mb-2">
            <CalendarDaysIcon className="h-4 w-4" />
            What&apos;s on
          </div>
          <h1 className="page-title text-3xl mb-3">Events</h1>
          <p className="text-gray-500 text-sm max-w-lg">
            Social nights, clinics and open play at badminton venues in Penang.
          </p>
        </div>

        {/* Area filter pills */}
        {availableAreas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              id="event-area-filter-all"
              type="button"
              onClick={() => setSelectedArea('')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !selectedArea
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              All
            </button>
            {availableAreas.map((area) => (
              <button
                key={area}
                id={`event-area-filter-${area.replace(/\s+/g, '-').toLowerCase()}`}
                type="button"
                onClick={() => setSelectedArea(area)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedArea === area
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        )}

        {/* Error message with Retry button */}
        {error && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
            <ErrorMessage message={error} className="p-0 border-0 bg-transparent text-red-700" />
            <button
              type="button"
              onClick={refetch}
              className="btn-secondary btn-sm bg-white hover:bg-gray-50 shrink-0 self-start sm:self-auto"
            >
              Retry
            </button>
          </div>
        )}

        {/* Event cards grid or states */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon="🏸"
            title={selectedArea ? 'No events found' : 'No upcoming events'}
            description={
              selectedArea
                ? `No events in ${selectedArea} right now.`
                : 'No upcoming events right now. Check back soon.'
            }
            action={
              selectedArea ? (
                <button
                  type="button"
                  onClick={() => setSelectedArea('')}
                  className="btn-secondary"
                >
                  Clear filter
                </button>
              ) : null
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event) => (
              <EventCard
                key={event._id}
                event={event}
                onOpenPoster={(src, caption) => setActivePoster({ src, caption })}
              />
            ))}
          </div>
        )}

        {/* Poster Lightbox */}
        <ImageLightbox
          isOpen={Boolean(activePoster)}
          onClose={() => setActivePoster(null)}
          src={activePoster?.src}
          alt={activePoster?.caption}
          caption={activePoster?.caption}
        />
      </div>
    </Layout>
  )
}

function EventCard({ event, onOpenPoster }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isLongDescription = (event.description?.length ?? 0) > 180

  const posterUrl = event.posterImage ? getImageUrl(event.posterImage) : null

  return (
    <div
      id={`event-card-${event._id}`}
      className="card-hover p-4 flex flex-col gap-3 group"
    >
      {/* Poster on top or fallback banner */}
      {posterUrl ? (
        <button
          type="button"
          onClick={() => onOpenPoster(posterUrl, event.title)}
          aria-label={`View poster for ${event.title}`}
          className="relative h-56 w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0 group/poster block cursor-zoom-in text-left focus:outline-none focus:ring-2 focus:ring-primary-500"
          title={`View poster for ${event.title}`}
        >
          <img
            src={posterUrl}
            alt={event.title}
            className="w-full h-full object-contain group-hover/poster:scale-[1.02] transition-transform duration-300"
          />
        </button>
      ) : (
        <div className="h-56 w-full rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col items-center justify-center p-4 text-center shrink-0">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-2 text-emerald-600">
            <CalendarDaysIcon className="h-6 w-6" />
          </div>
          <span className="text-sm font-semibold text-emerald-900">{formatDate(event.date)}</span>
          <span className="text-xs text-emerald-700 mt-0.5">
            {formatTime(event.startTime)} – {formatTime(event.endTime)}
          </span>
        </div>
      )}

      {/* Date and Time */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary-700">
        <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
        <span>{formatDate(event.date)}</span>
        <span className="text-gray-300">·</span>
        <ClockIcon className="h-3.5 w-3.5 shrink-0 ml-0.5" />
        <span>
          {formatTime(event.startTime)} – {formatTime(event.endTime)}
        </span>
      </div>

      {/* Title */}
      <h2 className="font-bold text-gray-900 text-lg leading-snug group-hover:text-primary-700 transition-colors">
        {event.title}
      </h2>

      {/* Venue name · area link */}
      {event.venue && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <MapPinIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <Link
            to={`/venues/${event.venue._id}`}
            className="hover:text-primary-600 hover:underline font-medium truncate"
          >
            {event.venue.name} · {event.venue.area}
          </Link>
        </div>
      )}

      {/* Fee */}
      {event.fee && (
        <div className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 self-start">
          <span>Fee:</span>
          <span>{event.fee}</span>
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div className="text-xs text-gray-600 leading-relaxed">
          <p
            className={
              !isExpanded && isLongDescription
                ? 'line-clamp-4 whitespace-pre-line'
                : 'whitespace-pre-line'
            }
          >
            {event.description}
          </p>
          {isLongDescription && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="text-primary-600 hover:text-primary-700 font-semibold mt-1 inline-block focus:outline-none"
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* How to join */}
      {event.howToJoin && (
        <div className="mt-auto bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 border border-gray-100">
          <p className="font-semibold text-gray-700 mb-0.5">How to join</p>
          <p className="whitespace-pre-line">{event.howToJoin}</p>
        </div>
      )}
    </div>
  )
}

