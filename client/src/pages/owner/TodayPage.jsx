import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOwnerVenue } from '../../context/OwnerVenueContext'
import { getAllBookings, getRevenueAnalytics } from '../../api/admin'
import { formatCurrency, formatDate, formatTime, getImageUrl } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  BuildingOffice2Icon,
  PhotoIcon,
  ArrowRightIcon,
  DocumentCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

const getLocalToday = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function TodayPage() {
  const { selectedVenue } = useOwnerVenue()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [todayBookings, setTodayBookings] = useState([])
  const [pendingBookings, setPendingBookings] = useState([])
  const [revenueData, setRevenueData] = useState(null)

  const localToday = getLocalToday()

  const loadData = useCallback(async () => {
    if (!selectedVenue?._id) return
    setLoading(true)
    setError(null)
    try {
      const [todayRes, pendingRes, revRes] = await Promise.all([
        getAllBookings({ venueId: selectedVenue._id, date: localToday }),
        getAllBookings({ venueId: selectedVenue._id, status: 'pending', sortBy: 'priority' }),
        getRevenueAnalytics(30),
      ])

      setTodayBookings(todayRes.data?.data ?? [])
      setPendingBookings(pendingRes.data?.data ?? [])
      setRevenueData(revRes.data ?? null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load today dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [selectedVenue?._id, localToday])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Extract venue revenue matching selectedVenue._id
  const venueRevenueRow = useMemo(() => {
    if (!revenueData?.data || !selectedVenue?._id) return null
    return revenueData.data.find((r) => String(r.venueId) === String(selectedVenue._id))
  }, [revenueData, selectedVenue?._id])

  // Today's schedule: active bookings (exclude cancelled, rejected, expired)
  const activeTodayBookings = useMemo(() => {
    return todayBookings.filter(
      (b) => !['cancelled', 'rejected', 'expired'].includes(b.status)
    )
  }, [todayBookings])

  // Group today's schedule by court, ordered by court number and start time
  const scheduleByCourt = useMemo(() => {
    const groups = {}
    activeTodayBookings.forEach((b) => {
      const courtLabel = b.courtId?.courtNumber != null
        ? `Court #${b.courtId.courtNumber}`
        : 'General Court'
      if (!groups[courtLabel]) {
        groups[courtLabel] = []
      }
      groups[courtLabel].push(b)
    })

    // Sort bookings within each court by start time
    Object.keys(groups).forEach((court) => {
      groups[court].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
    })

    // Sort courts by name / court number
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  }, [activeTodayBookings])

  // Count receipts waiting verification
  const receiptsWaitingCount = useMemo(() => {
    return pendingBookings.filter((b) => Boolean(b.receiptImage)).length
  }, [pendingBookings])

  if (!selectedVenue) return null

  if (loading) {
    return (
      <div className="page-container py-16 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const firstPhoto = selectedVenue.photos?.[0]
    ? getImageUrl(selectedVenue.photos[0])
    : null

  return (
    <div className="page-container space-y-8 animate-fadeIn">
      {error && <ErrorMessage message={error} />}

      {/* ── Venue Hero Card ── */}
      <div className="card overflow-hidden bg-white border border-gray-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row">
          {/* Photo / Placeholder */}
          <div className="md:w-64 h-48 md:h-auto shrink-0 bg-gray-100 relative overflow-hidden flex items-center justify-center">
            {firstPhoto ? (
              <img
                src={firstPhoto}
                alt={selectedVenue.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600 p-6">
                <PhotoIcon className="h-10 w-10 text-primary-400 mb-1" />
                <span className="text-xs font-semibold">No Venue Photo</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                  {selectedVenue.area}
                </span>
                <span className="text-xs text-gray-400">· Penang</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                {selectedVenue.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
                {selectedVenue.address}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <ClockIcon className="h-4 w-4 text-gray-400" />
                <span>
                  {formatTime(selectedVenue.operatingHours?.open)} – {formatTime(selectedVenue.operatingHours?.close)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
                <span>
                  {selectedVenue.numberOfCourts} {selectedVenue.numberOfCourts === 1 ? 'Court' : 'Courts'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                <span>{formatCurrency(selectedVenue.pricePerHour)} / hr</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today's Bookings */}
        <div className="card p-4 sm:p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CalendarDaysIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Today's Bookings
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {activeTodayBookings.length}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {formatDate(localToday)}
            </p>
          </div>
        </div>

        {/* Receipts to Verify */}
        <div className="card p-4 sm:p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DocumentCheckIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Receipts Waiting
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {receiptsWaitingCount}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {pendingBookings.length} pending total
            </p>
          </div>
        </div>

        {/* Revenue */}
        <div className="card p-4 sm:p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CurrencyDollarIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {revenueData?.period || 'Last 30 days'} Revenue
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {formatCurrency(venueRevenueRow?.totalRevenue || 0)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {venueRevenueRow?.bookingCount || 0} bookings
            </p>
          </div>
        </div>
      </div>

      {/* ── Needs Your Attention (Pending Bookings) ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-amber-500" />
              Needs Your Attention
            </h2>
            <p className="text-xs text-gray-500">
              Pending bookings waiting for payment review, soonest session first.
            </p>
          </div>
          {pendingBookings.length > 0 && (
            <button
              onClick={() => navigate('/owner/bookings')}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View all bookings <ArrowRightIcon className="h-3 w-3" />
            </button>
          )}
        </div>

        {pendingBookings.length === 0 ? (
          <div className="card p-8 text-center bg-white border border-gray-200">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">All caught up</h3>
            <p className="text-xs text-gray-500 mt-1">
              There are no pending bookings requiring review at this venue.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingBookings.map((b) => {
              const courtName = b.courtId?.courtNumber != null
                ? `Court #${b.courtId.courtNumber}`
                : 'Court'
              return (
                <div
                  key={b._id}
                  className="card p-4.5 bg-white border border-gray-200 hover:border-gray-300 transition-shadow flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {b.playerId?.fullName || 'Player'}
                        </p>
                        <p className="text-xs text-gray-500">{courtName}</p>
                      </div>
                      <Badge status={b.status} />
                    </div>

                    <div className="text-xs text-gray-600 space-y-0.5 pt-1">
                      <p className="font-medium text-gray-800">
                        {formatDate(b.date)} · {formatTime(b.startTime)}–{formatTime(b.endTime)}
                      </p>
                      <p className="text-gray-500">
                        Amount: <span className="font-semibold text-gray-900">{formatCurrency(b.amount)}</span>
                      </p>
                    </div>

                    <div className="pt-1">
                      {b.receiptImage ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          ✓ Receipt uploaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          ⚠️ No receipt yet
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => navigate('/owner/bookings')}
                      className="btn-primary btn-sm text-xs py-1.5"
                    >
                      Review receipt
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Today's Schedule ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-primary-600" />
            Today's Schedule
          </h2>
          <p className="text-xs text-gray-500">
            Confirmed and active sessions scheduled for {formatDate(localToday)}.
          </p>
        </div>

        {scheduleByCourt.length === 0 ? (
          <div className="card p-8 text-center bg-white border border-gray-200">
            <CalendarDaysIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-gray-900">No sessions scheduled today</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              There are no active bookings for {selectedVenue.name} today.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduleByCourt.map(([courtName, courtBookings]) => (
              <div key={courtName} className="card p-4.5 bg-white border border-gray-200">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm">{courtName}</h3>
                  <span className="text-xs text-gray-500 font-medium">
                    {courtBookings.length} {courtBookings.length === 1 ? 'slot' : 'slots'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {courtBookings.map((b) => (
                    <div
                      key={b._id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50/70 border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-xs font-bold text-gray-900">
                          {formatTime(b.startTime)} – {formatTime(b.endTime)}
                        </p>
                        <p className="text-xs text-gray-600 truncate mt-0.5">
                          {b.playerId?.fullName || 'Player'}
                        </p>
                      </div>
                      <Badge status={b.status} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
