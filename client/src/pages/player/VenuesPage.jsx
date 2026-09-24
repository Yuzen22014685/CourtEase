import { useState, useCallback } from 'react'
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

const AREAS = ['Bayan Lepas', 'Georgetown', 'Bukit Mertajam', 'Tanjung Bungah', 'Jelutong']

const AREA_COLOURS = {
  'Bayan Lepas':     'bg-blue-100 text-blue-700',
  'Georgetown':      'bg-purple-100 text-purple-700',
  'Bukit Mertajam':  'bg-orange-100 text-orange-700',
  'Tanjung Bungah':  'bg-teal-100 text-teal-700',
  'Jelutong':        'bg-rose-100 text-rose-700',
}

export default function VenuesPage() {
  const [selectedArea, setSelectedArea] = useState('')

  const fetchFn = useCallback(
    () => getVenues(selectedArea ? { area: selectedArea } : {}),
    [selectedArea]
  )

  const { data, loading, error } = useApi(fetchFn, [selectedArea])

  const venues = data?.data ?? []

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
          {AREAS.map((area) => (
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
      className="card-hover p-5 flex flex-col gap-4 group cursor-pointer block"
    >
      {/* Header band */}
      <div className="h-3 rounded-full bg-gradient-to-r from-primary-500 to-primary-400
                      group-hover:from-primary-600 group-hover:to-primary-500 transition-all" />

      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="font-bold text-gray-900 text-base leading-snug group-hover:text-primary-700
                         transition-colors">
            {venue.name}
          </h2>
          <span className={`badge shrink-0 ${areaColour}`}>{venue.area}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-gray-500">
          <MapPinIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{venue.address}</span>
        </div>
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
