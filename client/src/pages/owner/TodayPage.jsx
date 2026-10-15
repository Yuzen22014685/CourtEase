import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useOwnerVenue } from '../../context/OwnerVenueContext'
import { getAllBookings, getMonthlyInsights, getCommissionStatements } from '../../api/admin'
import {
  formatCurrency,
  formatDate,
  formatTime,
  getImageUrl,
  formatPaymentRef,
  formatPaymentMethod,
  formatPriceRange,
  currentMonthMY,
} from '../../utils/format'
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
  InformationCircleIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

const getLocalToday = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const parseTimeToMinutes = (t) => {
  if (!t) return 0
  const [h = 0, m = 0] = t.split(':').map(Number)
  return h * 60 + m
}

const getDurationHours = (start, end) => {
  const diffMinutes = parseTimeToMinutes(end) - parseTimeToMinutes(start)
  return diffMinutes > 0 ? diffMinutes / 60 : 0
}

const formatDuration = (hours) => {
  return hours % 1 === 0 ? `${hours} h` : `${hours.toFixed(1)} h`
}

export default function TodayPage() {
  const { selectedVenue } = useOwnerVenue()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [todayBookings, setTodayBookings] = useState([])
  const [pendingBookings, setPendingBookings] = useState([])
  const [monthlyInsights, setMonthlyInsights] = useState(null)
  const [commissionStatements, setCommissionStatements] = useState([])

  const selectedVenueId = selectedVenue?._id

  useEffect(() => {
    if (!selectedVenueId) return
    let active = true

    getCommissionStatements({ venueId: selectedVenueId })
      .then((res) => {
        if (active) {
          const list = Array.isArray(res.data?.data) ? res.data.data : []
          setCommissionStatements(list)
        }
      })
      .catch(() => {
        if (active) setCommissionStatements([])
      })

    return () => {
      active = false
    }
  }, [selectedVenueId])

  const unpaidStatements = useMemo(() => {
    return commissionStatements.filter((s) => s.status === 'unpaid')
  }, [commissionStatements])

  const rejectedStatement = useMemo(() => {
    return unpaidStatements.find((s) => Boolean(s.rejectionReason))
  }, [unpaidStatements])

  const oldestUnpaidStatement = useMemo(() => {
    if (!unpaidStatements.length) return null
    return [...unpaidStatements].sort((a, b) => (a.month || '').localeCompare(b.month || ''))[0]
  }, [unpaidStatements])

  const totalUnpaidDue = useMemo(() => {
    return unpaidStatements.reduce((sum, s) => sum + (s.amountDue || 0), 0)
  }, [unpaidStatements])

  const localToday = getLocalToday()

  const loadData = useCallback(async () => {
    if (!selectedVenue?._id) return
    setLoading(true)
    setError(null)
    try {
      const [todayRes, pendingRes, insightsRes] = await Promise.all([
        getAllBookings({ venueId: selectedVenue._id, date: localToday }),
        getAllBookings({ venueId: selectedVenue._id, status: 'pending', sortBy: 'priority' }),
        getMonthlyInsights(currentMonthMY(), selectedVenue._id),
      ])

      setTodayBookings(todayRes.data?.data ?? [])
      setPendingBookings(pendingRes.data?.data ?? [])
      setMonthlyInsights(insightsRes.data ?? null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load today dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [selectedVenue?._id, localToday])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Today's schedule: active bookings (exclude cancelled, rejected, expired)
  const activeTodayBookings = useMemo(() => {
    return todayBookings.filter(
      (b) => !['cancelled', 'rejected', 'expired'].includes(b.status)
    )
  }, [todayBookings])

  // Group today's schedule by court, ordered by court number and start time, with consecutive slots merged
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

    const processed = {}
    // Sort bookings within each court by start time, then merge consecutive slots
    Object.keys(groups).forEach((court) => {
      const sorted = [...groups[court]].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
      const merged = []
      for (const b of sorted) {
        const prev = merged[merged.length - 1]
        const prevPlayerId = prev?.playerId?._id || prev?.playerId
        const currPlayerId = b?.playerId?._id || b?.playerId

        if (
          prev &&
          String(prevPlayerId) === String(currPlayerId) &&
          prev.status === b.status &&
          prev.endTime === b.startTime
        ) {
          prev.endTime = b.endTime
          const hours = getDurationHours(prev.startTime, prev.endTime)
          prev.durationHours = hours
          prev.durationLabel = formatDuration(hours)
          if (Array.isArray(b.items) && b.items.length > 0) {
            prev.allItems = (prev.allItems || []).concat(b.items)
          }
        } else {
          const hours = getDurationHours(b.startTime, b.endTime)
          const initialItems = Array.isArray(b.items) ? [...b.items] : []
          merged.push({
            ...b,
            durationHours: hours,
            durationLabel: formatDuration(hours),
            allItems: initialItems,
          })
        }
      }
      const totalCourtHours = merged.reduce((sum, item) => sum + item.durationHours, 0)
      processed[court] = {
        slots: merged,
        totalHoursLabel: formatDuration(totalCourtHours),
      }
    })

    // Sort courts by name / court number
    return Object.entries(processed).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  }, [activeTodayBookings])

  // Count receipts waiting verification
  const receiptsWaitingCount = useMemo(() => {
    return pendingBookings.filter((b) => Boolean(b.receiptImage)).length
  }, [pendingBookings])

  // Check if selected venue has payment details configured
  const hasPaymentDetails = useMemo(() => {
    if (!selectedVenue) return true
    const qr = Boolean(selectedVenue.paymentInfo?.duitNowQr?.trim())
    const bank = Boolean(
      selectedVenue.paymentInfo?.bankName?.trim() &&
      selectedVenue.paymentInfo?.accountName?.trim() &&
      selectedVenue.paymentInfo?.accountNumber?.trim()
    )
    return qr || bank
  }, [selectedVenue])

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

      {/* Platform fee banner if any unpaid */}
      {unpaidStatements.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-amber-800 text-sm font-medium">
            {rejectedStatement ? (
              <>
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 shrink-0" />
                <span>A platform fee receipt was rejected — please upload a new one.</span>
              </>
            ) : (
              <>
                <BanknotesIcon className="h-5 w-5 text-amber-600 shrink-0" />
                <span>
                  Platform fee due: {formatCurrency(totalUnpaidDue)} ({unpaidStatements.length} statement{unpaidStatements.length !== 1 ? 's' : ''})
                </span>
              </>
            )}
          </div>
          <Link
            to={`/owner/insights?pay=${(rejectedStatement || oldestUnpaidStatement)?._id}#platform-fee`}
            className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs px-3.5 py-1.5 shrink-0 self-start sm:self-auto inline-flex items-center justify-center gap-1"
          >
            {rejectedStatement ? 'Upload new receipt' : 'Pay now'}
          </Link>
        </div>
      )}

      {/* Amber banner when missing payment details */}
      {!hasPaymentDetails && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-amber-800 text-sm font-medium">
            <InformationCircleIcon className="h-5 w-5 text-amber-600 shrink-0" />
            <span>Players can't book your venue until you add payment details.</span>
          </div>
          <button
            onClick={() => navigate('/owner/venue')}
            className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs px-3.5 py-1.5 shrink-0 self-start sm:self-auto"
          >
            Add payment details
          </button>
        </div>
      )}

      {/* ── Venue Hero Card ── */}
      <div className="card overflow-hidden bg-white border border-gray-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row">
          {/* Photo / Placeholder */}
          <div className="md:w-64 h-48 md:h-48 shrink-0 bg-gray-100 relative overflow-hidden flex items-center justify-center">
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
                <span>{formatPriceRange(selectedVenue)} / hr</span>
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
              Revenue this month
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {loading ? (
                <Spinner size="sm" />
              ) : (
                formatCurrency(monthlyInsights?.current?.revenue?.total || 0)
              )}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              confirmed payments
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
                  className="card p-5 bg-white border border-gray-200 hover:border-gray-300 transition-shadow flex flex-col justify-between space-y-3"
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
                      <p className="text-[11px] text-gray-500">
                        Ref {formatPaymentRef(b)} · {formatPaymentMethod(b.paymentMethod)}
                      </p>
                      {b.items && b.items.length > 0 && (
                        <p
                          className="text-xs text-purple-700 font-medium truncate pt-0.5"
                          title={b.items.map((it) => `${it.quantity} × ${it.name}`).join(', ')}
                        >
                          + add-ons: {b.items.map((it) => `${it.quantity} × ${it.name}`).join(', ')}
                        </p>
                      )}
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
                      onClick={() => navigate(`/owner/bookings?review=${b._id}`)}
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
            Active sessions (pending and confirmed) for {formatDate(localToday)}.
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
            {scheduleByCourt.map(([courtName, { slots, totalHoursLabel }]) => (
              <div key={courtName} className="card p-5 bg-white border border-gray-200">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm">{courtName}</h3>
                  <span className="text-xs text-gray-500 font-medium">
                    {totalHoursLabel} booked
                  </span>
                </div>

                <div className="space-y-2.5">
                  {slots.map((b) => {
                    const slotItems = b.allItems || b.items || []
                    const itemCount = slotItems.reduce((sum, it) => sum + (it.quantity || 1), 0)
                    return (
                      <div
                        key={b._id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50/70 border border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-gray-900">
                              {formatTime(b.startTime)} – {formatTime(b.endTime)}
                            </p>
                            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {b.durationLabel}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            {b.playerId?.fullName || 'Player'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {itemCount > 0 && (
                            <span
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200"
                              title={slotItems.map((it) => `${it.quantity} × ${it.name}`).join(', ')}
                            >
                              🛍 {itemCount} item{itemCount === 1 ? '' : 's'}
                            </span>
                          )}
                          <Badge status={b.status} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
