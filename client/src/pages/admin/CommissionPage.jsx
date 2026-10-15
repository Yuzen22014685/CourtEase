import { useState, useEffect, useMemo } from 'react'
import AdminLayout from '../../components/layout/AdminLayout'
import CommissionSettingsCard from '../../components/admin/CommissionSettingsCard'
import CommissionReviewModal from '../../components/admin/CommissionReviewModal'
import MonthPicker from '../../components/insights/MonthPicker'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ErrorMessage from '../../components/ui/ErrorMessage'
import {
  formatCurrency,
  formatMonth,
  shiftMonth,
  currentMonthMY,
  formatDateTime,
} from '../../utils/format'
import {
  getCommissionStatements,
  generateCommissionStatements,
} from '../../api/admin'
import {
  BanknotesIcon,
  SparklesIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

export default function CommissionPage() {
  const previousMonth = shiftMonth(currentMonthMY(), -1)

  {/* Generation state */}
  const [genMonth, setGenMonth] = useState(previousMonth)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [genError, setGenError] = useState(null)

  {/* Statements query state */}
  const [selectedMonth, setSelectedMonth] = useState(previousMonth)
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'submitted' | 'unpaid' | 'paid'
  const [refreshKey, setRefreshKey] = useState(0)

  {/* Data state */}
  const [statements, setStatements] = useState([])
  const [counts, setCounts] = useState({ unpaid: 0, submitted: 0, paid: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  {/* Review modal state */}
  const [selectedReviewStatement, setSelectedReviewStatement] = useState(null)

  {/* Fetch statements with stale-response guard */}
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    getCommissionStatements({ month: selectedMonth })
      .then((res) => {
        if (!active) return
        setStatements(res.data?.data || [])
        setCounts(res.data?.counts || { unpaid: 0, submitted: 0, paid: 0 })
      })
      .catch((err) => {
        if (!active) return
        setError(err.response?.data?.message || 'Failed to load commission statements')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedMonth, refreshKey])

  {/* Generate handler */}
  const handleGenerate = async () => {
    setGenerating(true)
    setGenError(null)
    setGenResult(null)

    try {
      const res = await generateCommissionStatements(genMonth)
      const { created = 0, skippedExisting = 0, noRevenue = 0 } = res.data || {}
      setGenResult(`Created ${created} · Already existed ${skippedExisting} · No revenue ${noRevenue}`)
      {/* If generated for currently viewed month, refresh list */}
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setGenError(err.response?.data?.message || 'Failed to generate statements')
    } finally {
      setGenerating(false)
    }
  }

  {/* Totals computed from the FULL month list */}
  const totalDue = useMemo(() => {
    return statements.reduce((sum, s) => sum + (s.amountDue || 0), 0)
  }, [statements])

  const totalCollected = useMemo(() => {
    return statements
      .filter((s) => s.status === 'paid')
      .reduce((sum, s) => sum + (s.amountDue || 0), 0)
  }, [statements])

  {/* Filtered statements for table display */}
  const displayedStatements = useMemo(() => {
    if (statusFilter === 'all') return statements
    return statements.filter((s) => s.status === statusFilter)
  }, [statements, statusFilter])

  const totalCount = statements.length

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Commission</h1>
          <p className="text-sm text-gray-500 mt-1">Monthly platform fee per venue, paid by venue owners.</p>
        </div>

        {/* 1. Commission Settings Card */}
        <CommissionSettingsCard />

        {/* 2. Generate Statements Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <SparklesIcon className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-bold text-gray-900">Generate Statements</h2>
          </div>

          <p className="text-xs text-gray-500">
            Compute confirmed court revenue for a completed month and produce monthly statements for all active venues.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <MonthPicker
              value={genMonth}
              onChange={setGenMonth}
              max={shiftMonth(currentMonthMY(), -1)}
            />

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary text-xs px-4 py-2.5 inline-flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Spinner size="sm" />
                  <span>Generating statements...</span>
                </>
              ) : (
                <>
                  <ArrowPathIcon className="h-4 w-4" />
                  <span>Generate statements</span>
                </>
              )}
            </button>
          </div>

          {genError && <ErrorMessage message={genError} />}

          {genResult && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{genResult}</span>
            </div>
          )}
        </div>

        {/* 3. Monthly Statements Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-primary-600" />
                <span>Monthly Statements</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Statements for {formatMonth(selectedMonth)}
              </p>
            </div>

            <MonthPicker
              value={selectedMonth}
              onChange={setSelectedMonth}
              max={currentMonthMY()}
            />
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('submitted')}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                statusFilter === 'submitted'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Submitted ({counts.submitted || 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unpaid')}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                statusFilter === 'unpaid'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Unpaid ({counts.unpaid || 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Paid ({counts.paid || 0})
            </button>
          </div>

          {/* Total Line (always full month) */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <span>
                <span className="text-gray-500">Total due: </span>
                <span className="font-bold text-gray-900">{formatCurrency(totalDue)}</span>
              </span>
              <span className="text-gray-300 hidden sm:inline">·</span>
              <span>
                <span className="text-gray-500">Collected: </span>
                <span className="font-bold text-emerald-700">{formatCurrency(totalCollected)}</span>
              </span>
            </div>
            <div className="text-gray-400 text-[11px]">
              {displayedStatements.length} of {totalCount} statements shown
            </div>
          </div>

          {error && <ErrorMessage message={error} />}

          {/* Statements View */}
          {loading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : displayedStatements.length === 0 ? (
            <EmptyState
              title={totalCount === 0 ? 'No statements for this month' : 'No statements matching filter'}
              description={
                totalCount === 0
                  ? `No commission statements have been generated for ${formatMonth(selectedMonth)}.`
                  : 'Try selecting a different status filter chip.'
              }
            />
          ) : (
            <>
              {/* Desktop Table (md and up) */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-600">
                    <tr>
                      <th className="py-3 px-4">Venue</th>
                      <th className="py-3 px-4">Court Revenue</th>
                      <th className="py-3 px-4">Rate</th>
                      <th className="py-3 px-4">Amount Due</th>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {displayedStatements.map((s) => (
                      <tr key={s._id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-gray-900">
                          <div>{s.venueId?.name || '—'}</div>
                          <div className="text-[11px] text-gray-400 font-normal">{s.venueId?.area || '—'}</div>
                          {s.status === 'unpaid' && s.rejectionReason && (
                            <div className="text-[11px] text-red-600 mt-0.5">
                              Rejected: {s.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">
                          <div>{formatCurrency(s.courtRevenue)}</div>
                          <div className="text-[10px] text-gray-400">{s.confirmedSessions || 0} sessions</div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 font-medium">
                          {s.rate}%
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {formatCurrency(s.amountDue)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-600">
                          {s.paymentRef}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            status={s.status}
                            className={
                              s.status === 'submitted'
                                ? 'bg-blue-100 text-blue-800'
                                : s.status === 'unpaid'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }
                          />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {s.status === 'submitted' && (
                            <button
                              type="button"
                              onClick={() => setSelectedReviewStatement(s)}
                              className="btn-primary text-xs px-3 py-1.5"
                            >
                              Review
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards (below md) */}
              <div className="md:hidden space-y-3">
                {displayedStatements.map((s) => (
                  <div
                    key={s._id}
                    className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 text-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{s.venueId?.name || '—'}</h4>
                        <p className="text-[11px] text-gray-400">{s.venueId?.area || '—'}</p>
                      </div>
                      <Badge
                        status={s.status}
                        className={
                          s.status === 'submitted'
                            ? 'bg-blue-100 text-blue-800'
                            : s.status === 'unpaid'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200/60">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Court Revenue</span>
                        <span className="font-medium text-gray-800">{formatCurrency(s.courtRevenue)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Amount Due ({s.rate}%)</span>
                        <span className="font-bold text-primary-600 text-sm">{formatCurrency(s.amountDue)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Ref</span>
                        <span className="font-mono text-gray-700">{s.paymentRef}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Sessions</span>
                        <span className="text-gray-700">{s.confirmedSessions || 0}</span>
                      </div>
                    </div>

                    {s.status === 'unpaid' && s.rejectionReason && (
                      <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded border border-red-100">
                        Rejected: {s.rejectionReason}
                      </p>
                    )}

                    {s.status === 'submitted' && (
                      <div className="pt-2 border-t border-gray-200/60 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedReviewStatement(s)}
                          className="btn-primary text-xs px-3 py-1.5 w-full"
                        >
                          Review payment
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 4. Review Modal */}
        <CommissionReviewModal
          statement={selectedReviewStatement}
          onClose={() => setSelectedReviewStatement(null)}
          onDone={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </AdminLayout>
  )
}
