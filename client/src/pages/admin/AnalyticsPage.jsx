import { useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import { getUtilization, getRevenueAnalytics } from '../../api/admin'
import AdminLayout from '../../components/layout/AdminLayout'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import { formatCurrency } from '../../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell, LabelList,
} from 'recharts'
import { ChartBarIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
import VenueTick from '../../components/ui/VenueTick'

const UTIL_COLOURS = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0']


export default function AnalyticsPage() {
  const { data: utilData, loading: utilLoading, error: utilError } = useApi(
    useCallback(() => getUtilization(30), [])
  )

  // Use revenue endpoint for "trends" (per-venue revenue last 30 days)
  const { data: trendData, loading: trendLoading, error: trendError } = useApi(
    useCallback(() => getRevenueAnalytics(30), [])
  )

  const utilChartData = (utilData?.data ?? []).map((d, i) => ({
    name: d.venueName.split(' ').slice(0, 2).join(' '),
    utilization: d.utilizationPct,
    bookedHours: d.bookedHours,
    availableHours: d.totalAvailableHours,
    fill: UTIL_COLOURS[i % UTIL_COLOURS.length],
  }))

  const trendChartData = (trendData?.data ?? []).map((d) => ({
    name: d.venueName.split(' ').slice(0, 2).join(' '),
    revenue: d.totalRevenue,
    bookings: d.bookingCount,
  }))

  return (
    <AdminLayout>
      <div className="page-container">
        <div className="mb-8">
          <h1 className="page-title">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Court utilization and revenue breakdown across all venues.
          </p>
        </div>

        {/* Court Utilization */}
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ChartBarIcon className="h-5 w-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Court Utilization Rate</h2>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            % of available court hours that were booked — last 30 days
          </p>

          {utilLoading ? (
            <div className="h-56 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : utilError ? (
            <ErrorMessage message={utilError} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={utilChartData} layout="vertical"
                  margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis type="category" dataKey="name"
                    tick={{ fontSize: 11, fill: '#6b7280' }} width={110} />
                  <Tooltip
                    formatter={(v, name) => [
                      name === 'utilization' ? `${v}%` : v,
                      name === 'utilization' ? 'Utilization' : name,
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="utilization" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 11, fill: '#6b7280', formatter: (v) => `${v}%` }}>
                    {utilChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Stats table */}
              <div className="mt-4 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Venue</th>
                      <th>Booked Hours</th>
                      <th>Available Hours</th>
                      <th>Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(utilData?.data ?? []).map((d) => (
                      <tr key={d.venueId}>
                        <td className="font-medium">{d.venueName}</td>
                        <td>{d.bookedHours}h</td>
                        <td>{d.totalAvailableHours}h</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                              <div
                                className="bg-primary-500 rounded-full h-1.5 transition-all"
                                style={{ width: `${Math.min(d.utilizationPct, 100)}%` }}
                              />
                            </div>
                            <span className="font-medium text-primary-700">{d.utilizationPct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Revenue and Bookings Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <ArrowTrendingUpIcon className="h-5 w-5 text-primary-600" />
              <h2 className="font-semibold text-gray-900">Revenue by Venue</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              Last 30 days · Grand total: {trendData ? formatCurrency(trendData.grandTotalRevenue) : '—'}
            </p>

            {trendLoading ? (
              <div className="h-56 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : trendError ? (
              <ErrorMessage message={trendError} />
            ) : trendChartData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No revenue data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trendChartData} margin={{ top: 20, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    height={40}
                    tick={<VenueTick />}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v) => `RM${v}`} />
                  <Tooltip
                    formatter={(v) => [formatCurrency(v), 'Revenue']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="revenue" fill="#16a34a" radius={[6, 6, 0, 0]} name="Revenue">
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

          {/* Bookings Trend */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <ChartBarIcon className="h-5 w-5 text-blue-500" />
              <h2 className="font-semibold text-gray-900">Bookings by Venue</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              Last 30 days · Total bookings: {trendData ? trendChartData.reduce((sum, d) => sum + d.bookings, 0) : '—'}
            </p>

            {trendLoading ? (
              <div className="h-56 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : trendError ? (
              <ErrorMessage message={trendError} />
            ) : trendChartData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No bookings data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trendChartData} margin={{ top: 20, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    height={40}
                    tick={<VenueTick />}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [v, 'Bookings']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="bookings" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Bookings">
                    <LabelList
                      dataKey="bookings"
                      position="top"
                      fontSize={11}
                      fill="#6b7280"
                      formatter={(v) => `${Math.round(v)}`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
