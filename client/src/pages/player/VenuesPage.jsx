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
} from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'
import { getImageUrl } from '../../utils/format'

const AREA_COLOURS = {
  'Bayan Lepas':     'bg-blue-100 text-blue-700',
  'Georgetown':      'bg-purple-100 text-purple-700',
  'Bukit Mertajam':  'bg-orange-100 text-orange-700',
  'Tanjung Bungah':  'bg-teal-100 text-teal-700',
  'Jelutong':        'bg-rose-100 text-rose-700',
  'Butterworth':     'bg-cyan-100 text-cyan-700',
  'Seberang Jaya':   'bg-indigo-100 text-indigo-700',
}

export default function VenuesPage() {
  const [selectedArea, setSelectedArea] = useState('')

  const fetchFn = useCallback(() => getVenues(), [])
  const { data, loading, error } = useApi(fetchFn, [])

  const allVenues = data?.data ?? []

  // Only show areas that have at least one active venue
  const availableAreas = useMemo(() => {
    return Array.from(new Set(allVenues.map((v) => v.area).filter(Boolean))).sort()
  }, [allVenues])

  // Filter venues by selected area
  const venues = useMemo(() => {
    if (!selectedArea) return allVenues
    return allVenues.filter((v) => v.area === selectedArea)
  }, [allVenues, selectedArea])

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary-600 text-sm font-medium mb-2">
            <BuildingOffice2Icon className="h-4 w-4" />
            Penang Badminton Venues
          </div>
          <h1 className="page-title text-3xl mb-3">Find Your Court</h1>
          <p className="text-gray-500 text-sm max-w-lg">
            Book hourly slots at premium badminton venues across Penang.
            Select an area to filter.
          </p>
        </div>

        {/* Area filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
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
        </div>

        {/* Error */}
        <ErrorMessage message={error} className="mb-6" />

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => <SkeletonCard key={n} />)}
          </div>
        ) : venues.length === 0 ? (
          <EmptyState
            icon="🏸"
            title="No venues found"
            description={selectedArea ? `No venues in ${selectedArea} yet.` : 'No venues available.'}
            action={
              selectedArea
                ? <button onClick={() => setSelectedArea('')} className="btn-secondary">
                    Clear filter
                  </button>
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
          className={`w-full h-full ${
            venue.photos?.[0] ? 'hidden' : 'flex'
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
          value={`RM ${venue.pricePerHour}`}
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
