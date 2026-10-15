import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useOwnerVenue } from '../../context/OwnerVenueContext'
import { getMonthlyInsights, getAdminVenues } from '../../api/admin'
import { currentMonthMY } from '../../utils/format'
import AdminLayout from '../../components/layout/AdminLayout'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import MonthPicker from '../../components/insights/MonthPicker'
import MonthlyInsightsView from '../../components/insights/MonthlyInsightsView'
import PlatformFeeSection from '../../components/owner/PlatformFeeSection'
import { BuildingOffice2Icon } from '@heroicons/react/24/outline'

export default function AnalyticsPage({ noLayout = false }) {
  const { isOwner } = useAuth()
  const ownerVenueCtx = useOwnerVenue()
  const ownerVenueLoading = isOwner ? Boolean(ownerVenueCtx?.loading) : false
  const ownerVenueCount = isOwner ? (ownerVenueCtx?.venues?.length ?? 0) : 0
  const selectedVenueId = isOwner ? ownerVenueCtx?.selectedVenue?._id : undefined

  const [month, setMonth] = useState(currentMonthMY())
  const [adminVenueId, setAdminVenueId] = useState('')
  const [adminVenues, setAdminVenues] = useState([])
  const [adminVenuesLoading, setAdminVenuesLoading] = useState(false)

  const [insightsData, setInsightsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  {/* Fetch venues list for Admin */}
  useEffect(() => {
    if (isOwner) return
    let active = true
    setAdminVenuesLoading(true)

    getAdminVenues()
      .then((res) => {
        if (active) {
          const list = Array.isArray(res.data?.data) ? res.data.data : []
          setAdminVenues(list)
        }
      })
      .catch(() => {
        if (active) {
          setAdminVenues([])
        }
      })
      .finally(() => {
        if (active) {
          setAdminVenuesLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [isOwner])

  {/* Fetch Monthly Insights with stale-response protection */}
  useEffect(() => {
    {/* Guard 1: For owner, wait until owner venues context finishes initial loading */}
    if (isOwner && ownerVenueLoading) return

    {/* Guard 1: Zero-venue owner */}
    if (isOwner && ownerVenueCount === 0) {
      setLoading(false)
      setInsightsData(null)
      setError(null)
      return
    }

    const effectiveVenueId = isOwner ? selectedVenueId : adminVenueId

    {/* Guard 1: If owner has venues but selectedVenue hasn't resolved yet, wait */}
    if (isOwner && !effectiveVenueId) return

    let active = true
    setLoading(true)
    setError(null)

    getMonthlyInsights(month, effectiveVenueId)
      .then((res) => {
        if (active) {
          setInsightsData(res.data ?? null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.response?.data?.message || 'Failed to load monthly insights.')
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [month, adminVenueId, isOwner, ownerVenueLoading, ownerVenueCount, selectedVenueId])

  const isZeroVenueOwner = isOwner && !ownerVenueLoading && ownerVenueCount === 0

  const content = (
    <div className="page-container">
      {/* ── Page Header & Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">{isOwner ? 'Insights' : 'Analytics'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isOwner
              ? "Your venue's monthly performance and bookings overview."
              : 'Monthly performance, revenue breakdown, and court utilisation.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Admin Venue Dropdown */}
          {!isOwner && (
            <div className="min-w-[160px]">
              <select
                id="analytics-venue-select"
                aria-label="Select venue"
                value={adminVenueId}
                onChange={(e) => setAdminVenueId(e.target.value)}
                disabled={adminVenuesLoading}
                className="input py-1.5 px-3 text-sm h-10 bg-white"
              >
                <option value="">All venues</option>
                {adminVenues.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month Picker */}
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>

      {/* ── Content States ── */}
      {isZeroVenueOwner ? (
        <div className="card py-8">
          <EmptyState
            icon={<BuildingOffice2Icon className="h-10 w-10 text-gray-400" />}
            title="No venue assigned yet"
            description="You don't have any venues assigned to your account. Contact an administrator to get access."
          />
        </div>
      ) : (
        <div className="space-y-8">
          {loading ? (
            <div className="card h-64 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <div className="card p-6">
              <ErrorMessage message={error} />
            </div>
          ) : (
            <MonthlyInsightsView
              data={insightsData}
              showPerVenue={!isOwner && !adminVenueId}
            />
          )}

          {isOwner && selectedVenueId && (
            <PlatformFeeSection venueId={selectedVenueId} />
          )}
        </div>
      )}
    </div>
  )

  if (noLayout) return content
  return <AdminLayout>{content}</AdminLayout>
}
