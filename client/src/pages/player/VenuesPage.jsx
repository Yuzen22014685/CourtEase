import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { getVenues } from '../../api/venues'
import Layout from '../../components/layout/Layout'
import SkeletonCard from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import {
  MapPinIcon,
  ClockIcon,
  CurrencyDollarIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'
import { getImageUrl, formatPriceRange } from '../../utils/format'
import { sortVenuesByDistance, formatDistance } from '../../utils/distance'
import LogoMark from '../../components/ui/LogoMark'

const AREA_COLOURS = {
  'Bayan Lepas': 'bg-blue-100 text-blue-700',
  'Georgetown': 'bg-purple-100 text-purple-700',
  'Bukit Mertajam': 'bg-orange-100 text-orange-700',
  'Tanjung Bungah': 'bg-teal-100 text-teal-700',
  'Jelutong': 'bg-rose-100 text-rose-700',
  'Butterworth': 'bg-cyan-100 text-cyan-700',
  'Seberang Jaya': 'bg-indigo-100 text-indigo-700',
}

export default function VenuesPage() {
  const [selectedArea, setSelectedArea] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [userLocation, setUserLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  const fetchFn = useCallback(() => getVenues(), [])
  const { data, loading, error } = useApi(fetchFn, [])

  const allVenues = useMemo(() => data?.data ?? [], [data])

  // Only show areas that have at least one active venue
  const availableAreas = useMemo(() => {
    return Array.from(new Set(allVenues.map((v) => v.area).filter(Boolean))).sort()
  }, [allVenues])

  // Area filter → search (every word must match name, area, address or a facility) → optional distance sort
  const venues = useMemo(() => {
    const base = allVenues || []
    const byArea = selectedArea ? base.filter((v) => v.area === selectedArea) : base
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    const filtered = terms.length === 0
      ? byArea
      : byArea.filter((v) => {
        const haystack = [v.name, v.area, v.address, ...(v.facilities || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return terms.every((t) => haystack.includes(t))
      })
    return userLocation ? sortVenuesByDistance(filtered, userLocation) : filtered
  }, [allVenues, selectedArea, searchQuery, userLocation])

  const isFiltering = Boolean(selectedArea || searchQuery.trim())
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedArea('')
  }








  const handleNearMe = useCallback(() => {
    if (locating) return
    if (!('geolocation' in navigator)) {
      setLocationError('Your browser does not support location.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setLocationError('')
        setLocating(false)
      },
      (err) => {
        let message = 'Could not get your location.'
        if (err.code === 1) {
          message = 'Location permission denied. Allow location access in your browser settings, or browse by area.'
        } else if (err.code === 2) {
          message = 'Your location could not be determined. Please try again.'
        } else if (err.code === 3) {
          message = 'Locating took too long. Please try again.'
        }
        setLocationError(message)
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }, [locating])

  const handleClearLocation = useCallback(() => {
    setUserLocation(null)
    setLocationError('')
  }, [])

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-court-blue">
        <LogoMark className="pointer-events-none absolute -right-16 -bottom-20 h-80 w-80 sm:h-[26rem] sm:w-[26rem] brightness-0 invert opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight max-w-xl">
            Find a court. Book your game.
          </h1>
          <p className="mt-2 text-sm sm:text-base text-white/90 max-w-lg">
            Check which courts are free and book the time that suits you.
          </p>

          {/* Search */}
          <div className="relative w-full sm:max-w-md mt-5">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="venue-search"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search venues, areas or facilities"
              aria-label="Search venues"
              className="input rounded-full py-2.5 pl-10 pr-10 w-full text-base sm:text-sm placeholder:text-sm border-transparent shadow-elevated focus:ring-white/70 focus:border-transparent [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>
      <div className="page-container">
        {/* Area filter & Near me */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            id="area-filter-all"
            onClick={() => setSelectedArea('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all
              ${!selectedArea
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'
              }`}
          >
            All Areas
          </button>
          {availableAreas.map((area) => (
            <button
              key={area}
              type="button"
              id={`area-filter-${area.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => setSelectedArea(area)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all
                ${selectedArea === area
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'
                }`}
            >
              {area}
            </button>
          ))}

          {/* Near me button / state */}
          {!userLocation ? (
            <button
              id="near-me-btn"
              type="button"
              onClick={handleNearMe}
              disabled={locating}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all inline-flex items-center gap-1.5 bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MapPinIcon className="h-4 w-4" />
              {locating ? 'Locating…' : 'Near me'}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-primary-50 text-primary-700 border border-primary-200">
              <MapPinIcon className="h-4 w-4 text-primary-600" />
              <span>Sorted by distance</span>
              <button
                type="button"
                id="clear-near-me-btn"
                onClick={handleClearLocation}
                className="text-xs text-primary-600 hover:text-primary-800 underline font-semibold ml-1"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {locationError ? (
          <p className="text-xs text-amber-600 mb-6 font-medium">
            {locationError}
          </p>
        ) : (
          <div className="mb-5" />
        )}

        {/* Error */}
        <ErrorMessage message={error} className="mb-6" />

        {!loading && !error && userLocation && (
          <p className="text-xs text-gray-400 mb-4">
            Straight-line distance from your current location. Your location is not saved.
          </p>
        )}

        {/* Grid */}
        {!loading && !error && isFiltering && venues.length > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            Showing {venues.length} of {allVenues.length} venues
          </p>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => <SkeletonCard key={n} />)}
          </div>
        ) : venues.length === 0 ? (
          <EmptyState
            icon={<LogoMark className="h-9 w-9" />}
            title="No venues found"
            description={
              searchQuery.trim()
                ? `No venues match “${searchQuery.trim()}”${selectedArea ? ` in ${selectedArea}` : ''}.`
                : selectedArea
                  ? `No venues in ${selectedArea} yet.`
                  : 'No venues available.'
            }
            action={
              isFiltering
                ? (
                  <button type="button" onClick={clearFilters} className="btn-secondary">
                    Clear search and filters
                  </button>
                )
                : null
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {venues.map((venue) => (
              <VenueCard key={venue._id} venue={venue} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

function VenueCard({ venue }) {
  const areaColour = AREA_COLOURS[venue.area] ?? 'bg-gray-100 text-gray-600'

  return (
    <Link
      to={`/venues/${venue._id}`}
      id={`venue-card-${venue._id}`}
      className="card-hover p-4 flex flex-col gap-3 group cursor-pointer block"
    >
      {/* Cover image or neutral placeholder */}
      <div className="relative h-44 w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-100 shrink-0">
        {venue.photos?.[0] ? (
          <img
            src={getImageUrl(venue.photos[0])}
            alt={venue.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.style.display = 'none'
              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className={`w-full h-full ${venue.photos?.[0] ? 'hidden' : 'flex'
            } flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400 p-4 text-center`}
        >
          <BuildingOffice2Icon className="h-9 w-9 text-gray-300 mb-1" />
          <span className="text-xs font-medium text-gray-500">{venue.name}</span>
        </div>
      </div>

      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h2 className="font-bold text-gray-900 text-base leading-snug group-hover:text-primary-700
                         transition-colors line-clamp-1">
            {venue.name}
          </h2>
          <span className={`badge shrink-0 ${areaColour}`}>{venue.area}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-gray-500">
          <MapPinIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="line-clamp-1">{venue.address}</span>
        </div>
        {typeof venue.distanceKm === 'number' && (
          <div className="mt-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
              <MapPinIcon className="h-3 w-3" />
              {formatDistance(venue.distanceKm)}
            </span>
          </div>
        )}
        {venue.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mt-2 leading-relaxed">
            {venue.description}
          </p>
        )}
        {/* Rating */}
        <div className="mt-2">
          {venue.rating != null ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              <StarIcon className="h-3.5 w-3.5 text-amber-400" />
              {venue.rating.toFixed(1)}
              <span className="font-normal text-gray-400">({venue.reviewCount})</span>
            </span>
          ) : (
            <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-500">
              New
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
        <StatItem
          icon={<ClockIcon className="h-4 w-4" />}
          label="Hours"
          value={`${venue.operatingHours.open}–${venue.operatingHours.close}`}
        />
        <StatItem
          icon={<BuildingOffice2Icon className="h-4 w-4" />}
          label="Courts"
          value={venue.numberOfCourts}
        />
        <StatItem
          icon={<CurrencyDollarIcon className="h-4 w-4" />}
          label="Per hour"
          value={formatPriceRange(venue)}
        />
      </div>

      {/* CTA */}
      <div className="mt-auto">
        <span className="btn-primary w-full justify-center text-sm py-2.5 rounded-lg
                         font-medium inline-flex items-center gap-2">
          Book Now →
        </span>
      </div>
    </Link>
  )
}

function StatItem({ icon, label, value }) {
  return (
    <div className="flex flex-col items-center text-center gap-1">
      <span className="text-primary-500">{icon}</span>
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs font-semibold text-gray-800">{value}</span>
    </div>
  )
}
