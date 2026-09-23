import { useCallback, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { getAllBookings, getRevenueAnalytics, getPeakHours } from '../../api/admin'
import { getVenues } from '../../api/venues'
import AdminLayout from '../../components/layout/AdminLayout'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import { SkeletonText } from '../../components/ui/SkeletonCard'
import { formatCurrency, formatDate, formatTime, todayString } from '../../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList
} from 'recharts'
import {
  CalendarDaysIcon,
  CurrencyDollarIcon,
  XCircleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import VenueTick from '../../components/ui/VenueTick'

const GREEN_SHADES = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0']

export default function DashboardPage() {
  // KPI: today's bookings
  const today = todayString()
  const { data: todayData, loading: todayLoading } = useApi(
    useCallback(() => getAllBookings({ date: today }), [today])
  )
  // KPI: monthly revenue
  const { data: revenueMonthData, loading: revMonthLoading } = useApi(
    useCallback(() => getRevenueAnalytics(30), [])
  )
  // Revenue chart (7 days)
  const { data: revenueData, loading: revenueLoading, error: revenueError } = useApi(
    useCallback(() => getRevenueAnalytics(7), [])
  )
  // Venues (for filter)
  const { data: venuesData } = useApi(useCallback(() => getVenues(), []))
  const [peakVenueId, setPeakVenueId] = useState('')

  // Peak hours chart
  const { data: peakData, loading: peakLoading, error: peakError } = useApi(
    useCallback(() => getPeakHours(30, peakVenueId), [peakVenueId]),
    [peakVenueId]
  )
  // Recent bookings
  const { data: bookingsData, loading: bookingsLoading, error: bookingsError } = useApi(
    useCallback(() => getAllBookings({}), [])
  )

  const todayCount = todayData?.data?.length ?? 0
  const monthRevenue = revenueMonthData?.grandTotalRevenue ?? 0
  const cancelledCount = (bookingsData?.data ?? []).filter(b => b.status === 'cancelled').length
  const recentBookings = (bookingsData?.data ?? []).slice(0, 10)

  const revenueChartData = (revenueData?.data ?? []).map((d, i) => ({
    name: d.venueName.split(' ').slice(0, 2).join(' '),
    revenue: d.totalRevenue,
    fill: GREEN_SHADES[i % GREEN_SHADES.length],
  }))

  const peakChartData = (peakData?.data ?? []).map((d) => ({
    name: d.label,
    bookings: d.bookings,
  }))

  const avgBookings = peakChartData.length > 0
    ? (peakChartData.reduce((sum, d) => sum + d.bookings, 0) / peakChartData.length).toFixed(1)
    : 0

  return (
    <AdminLayout>
      <div className="page-container">
        <div className="mb-8">
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview for today, {formatDate(today)}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <KpiCard
            icon={<CalendarDaysIcon className="h-6 w-6 text-blue-600" />}
            bg="bg-blue-50"
            label="Today's Bookings"
            value={todayLoading ? <Spinner size="sm" /> : todayCount}
            sub={`${(todayData?.data ?? []).filter(b => b.status === 'confirmed').length} confirmed`}
          />
          <KpiCard
            icon={<CurrencyDollarIcon className="h-6 w-6 text-primary-600" />}
            bg="bg-primary-50"
            label="Revenue (30 Days)"
            value={revMonthLoading ? <Spinner size="sm" /> : formatCurrency(monthRevenue)}
            sub="Last 30 days"
          />
          <KpiCard
            icon={<XCircleIcon className="h-6 w-6 text-red-500" />}
            bg="bg-red-50"
            label="Cancelled Bookings"
            value={bookingsLoading ? <Spinner size="sm" /> : cancelledCount}
            sub="All time"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue chart */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <ChartBarIcon className="h-4 w-4 text-primary-600" />
              <h2 className="font-semibold text-gray-900 text-sm">Revenue by Venue</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5">Last 7 days</p>
            {revenueLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : revenueError ? (
              <ErrorMessage message={revenueError} />
            ) : revenueChartData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No revenue data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueChartData} margin={{ top: 20, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    height={40}
                    tick={<VenueTick />}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v) => `RM${v}`}
                    domain={[0, (dataMax) => (dataMax === 0 ? 10 : Math.ceil(dataMax * 1.1))]} allowDecimals={false} tickCount={6}
                  />
                  <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {revenueChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="revenue"
                      position="top"
                      fontSize={11}
                      fill="#6b7280"
                      formatter={(v) => `RM${Math.round(v)}`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Peak hours chart */}
          <div className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ChartBarIcon className="h-4 w-4 text-primary-600" />
                  <h2 className="font-semibold text-gray-900 text-sm">Peak Booking Hours</h2>
                </div>
                <p className="text-xs text-gray-400">
                  Last 30 days · Peak: {peakData?.peakHour ?? '—'}
                </p>
              </div>
              <select
                className="select text-sm py-1.5 w-full sm:w-auto sm:min-w-[140px]"
                value={peakVenueId}
                onChange={(e) => setPeakVenueId(e.target.value)}
              >
                <option value="">All Venues</option>
                {(venuesData?.data ?? []).map(v => (
                  <option key={v._id} value={v._id}>{v.name}</option>
                ))}
              </select>
            </div>

            {peakLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : peakError ? (
              <ErrorMessage message={peakError} />
            ) : peakChartData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No peak hour data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={peakChartData} margin={{ top: 0, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v) => [v, 'Bookings']} />
                  <ReferenceLine y={Number(avgBookings)} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: `Average: ${avgBookings}/hr`, fill: '#d97706', fontSize: 10 }} />
                  <Bar dataKey="bookings" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Bookings Table */}
        <div className="table-wrapper">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Bookings</h2>
          </div>
          {bookingsLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5].map(n => <SkeletonText key={n} lines={1} />)}
            </div>
          ) : bookingsError ? (
            <div className="p-5"><ErrorMessage message={bookingsError} /></div>
          ) : recentBookings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No bookings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Venue</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => (
                    <tr key={b._id}>
                      <td>
                        <p className="font-medium text-gray-900">{b.playerId?.fullName ?? '—'}</p>
                        <p className="text-xs text-gray-400">{b.playerId?.email ?? '—'}</p>
                      </td>
                      <td>
                        <p className="font-medium">{b.venueId?.name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{b.venueId?.area ?? '—'}</p>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(b.date)}</td>
                      <td className="whitespace-nowrap text-xs">
                        {formatTime(b.startTime)}–{formatTime(b.endTime)}
                      </td>
                      <td className="font-medium text-primary-700">{formatCurrency(b.amount)}</td>
                      <td><Badge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

function KpiCard({ icon, bg, label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1 leading-none flex items-center">{value}</div>
          {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
      </div>
    </div>
  )
}
