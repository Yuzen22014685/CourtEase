import { formatCurrency, formatMonth } from '../../utils/format'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  CurrencyDollarIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ClockIcon,
  ShoppingBagIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'

function ChangeBadge({ value, isPoints = false, previousMonth }) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          —
        </span>
        {previousMonth && (
          <span className="text-[11px] text-gray-400">
            vs {formatMonth(previousMonth)}
          </span>
        )}
      </div>
    )
  }

  const isPositive = value > 0
  const isNegative = value < 0
  const sign = isPositive ? '▲ ' : isNegative ? '▼ ' : ''
  const colorClass = isPositive
    ? 'text-emerald-700 bg-emerald-50'
    : isNegative
    ? 'text-rose-700 bg-rose-50'
    : 'text-gray-600 bg-gray-100'

  const displayVal = isPoints
    ? `${sign}${isPositive ? '+' : ''}${value} pts`
    : `${sign}${Math.abs(value)}%`

  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${colorClass}`}>
        {displayVal}
      </span>
      {previousMonth && (
        <span className="text-[11px] text-gray-400">
          vs {formatMonth(previousMonth)}
        </span>
      )}
    </div>
  )
}

export default function MonthlyInsightsView({ data, showPerVenue = false }) {
  if (!data) return null

  const current = data.current || {}
  const change = data.change || {}
  const previousMonth = data.previousMonth
  const perVenue = data.perVenue || []

  // Trim peak hours to range between first and last hour with bookings
  const peakList = current.peakHours || []
  const hoursWithBookings = peakList.filter((h) => h.bookings > 0)
  const hasAnyPeakBookings = hoursWithBookings.length > 0
  const trimmedPeakHours = hasAnyPeakBookings
    ? peakList.slice(
        Math.min(...hoursWithBookings.map((h) => h.hour)),
        Math.max(...hoursWithBookings.map((h) => h.hour)) + 1
      )
    : []

  const topItems = current.topItems || []

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Revenue */}
        <div className="card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Revenue
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CurrencyDollarIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {formatCurrency(current.revenue?.total ?? 0)}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              Courts {formatCurrency(current.revenue?.court ?? 0)} · Shop {formatCurrency(current.revenue?.shop ?? 0)}
            </p>
          </div>
          <ChangeBadge value={change.revenue} previousMonth={previousMonth} />
        </div>

        {/* Confirmed Sessions */}
        <div className="card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Confirmed Sessions
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <CheckCircleIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {current.bookings?.confirmed ?? 0}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              Active court sessions
            </p>
          </div>
          <ChangeBadge value={change.bookings} previousMonth={previousMonth} />
        </div>

        {/* Court Utilisation */}
        <div className="card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Utilisation
              </span>
              <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                <ChartBarIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {current.utilisation?.pct ?? 0}%
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              {current.utilisation?.bookedHours ?? 0} h of {current.utilisation?.capacityHours ?? 0} h
            </p>
          </div>
          <ChangeBadge value={change.utilisationPoints} isPoints previousMonth={previousMonth} />
        </div>

        {/* Awaiting Verification */}
        <div className="card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Awaiting Verification
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <ClockIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {current.awaitingVerification?.count ?? 0}
              <span className="text-sm font-normal text-gray-500 ml-1.5">
                ({formatCurrency(current.awaitingVerification?.amount ?? 0)})
              </span>
            </p>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Not counted as revenue until confirmed
          </p>
        </div>
      </div>

      {/* ── Secondary booking lifecycle summary line ── */}
      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200/80 rounded-lg px-3.5 py-2">
        Cancelled {current.bookings?.cancelled ?? 0} · Rejected {current.bookings?.rejected ?? 0} · Expired (unpaid) {current.bookings?.expired ?? 0}
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Busiest Days */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <ChartBarIcon className="h-5 w-5 text-primary-600 shrink-0" />
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Busiest Days</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Total sessions played by day of week (Monday–Sunday)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={current.busiestDays || []}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                formatter={(v) => [v, 'Sessions']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="bookings" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hours */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <ClockIcon className="h-5 w-5 text-blue-600 shrink-0" />
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Peak Booking Hours</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Hourly distribution of booked court sessions
          </p>
          {!hasAnyPeakBookings ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
              No sessions this month
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={trimmedPeakHours}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  formatter={(v) => [v, 'Sessions']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Top-Selling Add-Ons ── */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <ShoppingBagIcon className="h-5 w-5 text-amber-600 shrink-0" />
          <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Top-Selling Add-Ons</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Shop products and services ordered with confirmed bookings
        </p>

        {topItems.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No add-on sales this month
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium text-right">Units Sold</th>
                  <th className="py-2 font-medium text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topItems.map((item, idx) => (
                  <tr key={`${item.name}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-2.5 font-medium text-gray-900">{item.name}</td>
                    <td className="py-2.5 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900">
                      {formatCurrency(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Per-Venue Breakdown (Admin All-Venues View) ── */}
      {showPerVenue && perVenue.length > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <BuildingOffice2Icon className="h-5 w-5 text-indigo-600 shrink-0" />
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Venue Breakdown</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Performance and revenue by venue for this month
          </p>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="py-2.5 font-medium">Venue</th>
                  <th className="py-2.5 font-medium text-right">Revenue</th>
                  <th className="py-2.5 font-medium text-right">Confirmed</th>
                  <th className="py-2.5 font-medium text-right">Utilisation</th>
                  <th className="py-2.5 font-medium text-right">Awaiting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {perVenue.map((v) => (
                  <tr key={v.venueId} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3">
                      <div className="font-semibold text-gray-900">{v.name}</div>
                      <div className="text-xs text-gray-400">{v.area}</div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="font-semibold text-gray-900">{formatCurrency(v.revenue?.total ?? 0)}</div>
                      <div className="text-[11px] text-gray-400">
                        Courts {formatCurrency(v.revenue?.court ?? 0)} · Shop {formatCurrency(v.revenue?.shop ?? 0)}
                      </div>
                    </td>
                    <td className="py-3 text-right text-gray-700 font-medium">
                      {v.confirmed}
                    </td>
                    <td className="py-3 text-right font-medium text-primary-700">
                      {v.utilisationPct}%
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-medium text-gray-800">{v.awaiting?.count ?? 0}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        ({formatCurrency(v.awaiting?.amount ?? 0)})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="md:hidden space-y-3">
            {perVenue.map((v) => (
              <div
                key={v.venueId}
                className="p-3.5 bg-gray-50/80 border border-gray-200/80 rounded-lg space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{v.name}</h3>
                    <p className="text-xs text-gray-400">{v.area}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900 text-sm">
                      {formatCurrency(v.revenue?.total ?? 0)}
                    </span>
                    <p className="text-[10px] text-gray-400">
                      Courts {formatCurrency(v.revenue?.court ?? 0)} · Shop {formatCurrency(v.revenue?.shop ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-200/60 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Confirmed</span>
                    <span className="font-medium text-gray-800">{v.confirmed}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Utilisation</span>
                    <span className="font-medium text-primary-700">{v.utilisationPct}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Awaiting</span>
                    <span className="font-medium text-gray-800">{v.awaiting?.count ?? 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footnote ── */}
      <p className="text-xs text-gray-400 text-center sm:text-left pt-1">
        Revenue counts payments confirmed by the venue, by session date. Cancellations after confirmation are included (no refunds).
      </p>
    </div>
  )
}
