import { useState, useEffect } from 'react'
import { getVenueCourts, updateCourtStatus } from '../../api/admin'
import { formatDate, formatTime, formatPaymentRef } from '../../utils/format'
import Spinner from '../ui/Spinner'

export default function CourtStatusList({ venueId }) {
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [maintenanceNotice, setMaintenanceNotice] = useState(null)

  useEffect(() => {
    let isMounted = true

    const fetchCourts = async () => {
      if (!venueId) return
      setLoading(true)
      setError(null)
      try {
        const res = await getVenueCourts(venueId)
        if (isMounted) {
          const list = (res.data?.courts || [])
            .filter((c) => c.status !== 'inactive')
            .sort((a, b) => a.courtNumber - b.courtNumber)
          setCourts(list)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || err.message || 'Failed to load courts.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchCourts()

    return () => {
      isMounted = false
    }
  }, [venueId])

  const handleToggleStatus = async (court) => {
    if (updatingId) return
    const nextStatus = court.status === 'active' ? 'maintenance' : 'active'
    setUpdatingId(court._id)
    setError(null)

    try {
      const res = await updateCourtStatus(venueId, court._id, nextStatus)
      const updatedCourt = res.data?.court

      if (updatedCourt) {
        setCourts((prev) =>
          prev.map((c) => (c._id === updatedCourt._id ? { ...c, ...updatedCourt } : c))
        )
      }

      if (nextStatus === 'maintenance' && res.data?.upcomingBookings?.length > 0) {
        setMaintenanceNotice({
          courtNumber: updatedCourt?.courtNumber ?? court.courtNumber,
          bookings: res.data.upcomingBookings,
        })
      } else if (nextStatus === 'active') {
        // If this court was currently highlighted in notice, clear it
        if (maintenanceNotice?.courtNumber === (updatedCourt?.courtNumber ?? court.courtNumber)) {
          setMaintenanceNotice(null)
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update court status.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Maintenance stops new bookings on a court. Existing bookings are kept. Changes here apply immediately — no need to click Save.
      </p>

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
          <Spinner size="sm" />
          <span>Loading courts...</span>
        </div>
      ) : courts.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-1">No active courts found.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white overflow-hidden">
          {courts.map((court) => {
            const isUpdating = updatingId === court._id
            const isMaintenance = court.status === 'maintenance'

            return (
              <div
                key={court._id}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-gray-900">Court {court.courtNumber}</span>
                  {court.status === 'active' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                      Maintenance
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleToggleStatus(court)}
                  className={`btn-secondary text-xs px-2.5 py-1 font-medium transition-colors ${
                    isMaintenance
                      ? 'hover:border-green-600 hover:text-green-700'
                      : 'hover:border-amber-600 hover:text-amber-700'
                  }`}
                >
                  {isUpdating ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner size="sm" />
                      <span>Updating...</span>
                    </span>
                  ) : isMaintenance ? (
                    'Set active'
                  ) : (
                    'Set maintenance'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Amber notice for existing bookings on maintenance court */}
      {maintenanceNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-2 text-xs">
          <p className="font-semibold">
            Court {maintenanceNotice.courtNumber} is under maintenance. These bookings are kept — please contact the players:
          </p>
          <div className="space-y-1.5">
            {maintenanceNotice.bookings.map((booking, idx) => {
              const dateStr = formatDate(booking.date)
              const timeRange = `${formatTime(booking.startTime)}–${formatTime(booking.endTime)}`
              const courtStr = `Court ${booking.courtNumber ?? maintenanceNotice.courtNumber}`
              const refStr = formatPaymentRef(booking)
              const playerStr = booking.playerName || 'Player'
              const statusStr = booking.status
                ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
                : 'Confirmed'

              return (
                <div
                  key={booking._id || idx}
                  className="bg-white/80 border border-amber-200/60 rounded-lg p-2 text-[11px] text-amber-950 flex flex-wrap items-center gap-x-2 gap-y-1 leading-tight"
                >
                  <span className="font-medium">{dateStr}</span>
                  <span className="text-amber-400">·</span>
                  <span>{timeRange}</span>
                  <span className="text-amber-400">·</span>
                  <span>{courtStr}</span>
                  <span className="text-amber-400">·</span>
                  <span className="font-mono text-gray-700">{refStr}</span>
                  <span className="text-amber-400">·</span>
                  <span className="font-medium text-gray-800">{playerStr}</span>
                  <span className="text-amber-400">·</span>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                    {statusStr}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
