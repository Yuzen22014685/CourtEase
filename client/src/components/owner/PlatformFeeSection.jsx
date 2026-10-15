import { useState, useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { getCommissionStatements, getCommissionPaymentInfo } from '../../api/admin'
import { formatCurrency, formatMonth, formatDateTime } from '../../utils/format'
import Spinner from '../ui/Spinner'
import ErrorMessage from '../ui/ErrorMessage'
import EmptyState from '../ui/EmptyState'
import PayPlatformFeeModal from './PayPlatformFeeModal'
import {
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'

export default function PlatformFeeSection({ venueId }) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [statements, setStatements] = useState([])
  const [platformSettings, setPlatformSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [activeModalStatement, setActiveModalStatement] = useState(null)

  const sectionRef = useRef(null)
  const handledDeepLinkRef = useRef(false)
  const scrolledRef = useRef(false)

  // Fetch statements and platform info for this venue
  useEffect(() => {
    if (!venueId) return
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      getCommissionStatements({ venueId }),
      getCommissionPaymentInfo().catch(() => ({ data: { data: null } })),
    ])
      .then(([stmtRes, infoRes]) => {
        if (!active) return
        const list = Array.isArray(stmtRes.data?.data) ? stmtRes.data.data : []
        setStatements(list)
        setPlatformSettings(infoRes.data?.data || null)
      })
      .catch((err) => {
        if (!active) return
        setError(err.response?.data?.message || 'Failed to load platform fee statements.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [venueId, refreshKey])

  // Sort statements newest month first
  const sortedStatements = [...statements].sort((a, b) => (b.month || '').localeCompare(a.month || ''))

  // Handle deep link ?pay=<statementId> and #platform-fee anchor scroll (only once after loading)
  useEffect(() => {
    if (loading) return

    const payId = searchParams.get('pay')
    const shouldScroll = location.hash === '#platform-fee' || Boolean(payId)

    if (!handledDeepLinkRef.current) {
      handledDeepLinkRef.current = true
      if (payId) {
        const target = statements.find((s) => s._id === payId)
        if (target && target.status === 'unpaid') {
          setActiveModalStatement(target)
        }
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete('pay')
          return next
        }, { replace: true })
      }
    }

    if (!scrolledRef.current && shouldScroll) {
      scrolledRef.current = true
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [loading, statements, location.hash, searchParams, setSearchParams])

  const rate = platformSettings?.commissionRate ?? (sortedStatements[0]?.rate ?? 5)
  const includeAddOns = platformSettings?.includeAddOns ?? (sortedStatements[0]?.includeAddOns ?? false)

  const renderStatusBadge = (s) => {
    if (s.status === 'unpaid') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          Due
        </span>
      )
    }
    if (s.status === 'submitted') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Awaiting verification
        </span>
      )
    }
    if (s.status === 'paid') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Paid
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
        {s.status}
      </span>
    )
  }

  const handleModalDone = () => {
    setActiveModalStatement(null)
    setRefreshKey((k) => k + 1)
  }

  return (
    <section id="platform-fee" ref={sectionRef} className="space-y-4 pt-4">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Platform fee</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Monthly CourtEase fee: {rate}% of confirmed court revenue{includeAddOns ? ' and add-ons' : ''}.
        </p>
      </div>

      {loading ? (
        <div className="card h-48 flex flex-col items-center justify-center bg-white border border-gray-200">
          <Spinner size="md" />
          <p className="text-xs text-gray-500 mt-2">Loading platform fee statements…</p>
        </div>
      ) : error ? (
        <div className="card p-5 bg-white border border-gray-200">
          <ErrorMessage message={error} />
        </div>
      ) : sortedStatements.length === 0 ? (
        <div className="card p-8 bg-white border border-gray-200">
          <EmptyState
            icon="📋"
            title="No platform fee statements yet."
            description="Statements are generated by the administrator at the beginning of each month."
          />
        </div>
      ) : (
        <>
          {/* Mobile Stacked Cards (<md) */}
          <div className="space-y-3 md:hidden">
            {sortedStatements.map((s) => (
              <div
                key={s._id}
                className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-900 text-sm">
                    {formatMonth(s.month)}
                  </span>
                  {renderStatusBadge(s)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-gray-100">
                  <div>
                    <span className="text-gray-500 block">Court revenue</span>
                    <span className="font-semibold text-gray-800">
                      {formatCurrency(s.courtRevenue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Amount due</span>
                    <span className="font-bold text-primary-700">
                      {formatCurrency(s.amountDue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Payment ref</span>
                    <span className="font-mono font-medium text-gray-800">
                      {s.paymentRef}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Confirmed sessions</span>
                    <span className="text-gray-800">{s.confirmedSessions ?? '—'}</span>
                  </div>
                </div>

                {s.status === 'unpaid' && s.rejectionReason && (
                  <div className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">
                    <p className="font-semibold">Receipt rejected:</p>
                    <p className="mt-0.5">{s.rejectionReason}</p>
                  </div>
                )}

                {s.status === 'submitted' && s.submittedAt && (
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <span>Submitted {formatDateTime(s.submittedAt)}</span>
                  </p>
                )}

                {s.status === 'paid' && s.verifiedAt && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    <span>Verified {formatDateTime(s.verifiedAt)}</span>
                  </p>
                )}

                {s.status === 'unpaid' && (
                  <button
                    type="button"
                    onClick={() => setActiveModalStatement(s)}
                    className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                  >
                    {s.rejectionReason ? (
                      <>
                        <ArrowUpTrayIcon className="h-4 w-4" />
                        <span>Upload new receipt</span>
                      </>
                    ) : (
                      <>
                        <BanknotesIcon className="h-4 w-4" />
                        <span>Pay now</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block card overflow-hidden border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="table min-w-full">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">Month</th>
                    <th className="whitespace-nowrap">Court Revenue</th>
                    <th className="whitespace-nowrap">Amount Due</th>
                    <th className="whitespace-nowrap">Reference</th>
                    <th className="whitespace-nowrap">Status</th>
                    <th className="text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedStatements.map((s) => (
                    <tr key={s._id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="font-semibold text-gray-900 whitespace-nowrap">
                        {formatMonth(s.month)}
                      </td>
                      <td className="text-gray-700 whitespace-nowrap">
                        {formatCurrency(s.courtRevenue)}
                      </td>
                      <td className="font-bold text-primary-700 whitespace-nowrap">
                        {formatCurrency(s.amountDue)}
                      </td>
                      <td className="font-mono text-xs text-gray-700 whitespace-nowrap">
                        {s.paymentRef}
                      </td>
                      <td className="whitespace-nowrap">
                        <div>
                          {renderStatusBadge(s)}
                          {s.status === 'submitted' && s.submittedAt && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              Submitted {formatDateTime(s.submittedAt)}
                            </p>
                          )}
                          {s.status === 'paid' && s.verifiedAt && (
                            <p className="text-[10px] text-emerald-700 mt-0.5">
                              Verified {formatDateTime(s.verifiedAt)}
                            </p>
                          )}
                          {s.status === 'unpaid' && s.rejectionReason && (
                            <p
                              className="text-[10px] text-red-600 mt-0.5 max-w-xs truncate"
                              title={s.rejectionReason}
                            >
                              Receipt rejected: {s.rejectionReason}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {s.status === 'unpaid' ? (
                          <button
                            type="button"
                            onClick={() => setActiveModalStatement(s)}
                            className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                          >
                            {s.rejectionReason ? (
                              <>
                                <ArrowUpTrayIcon className="h-3.5 w-3.5" />
                                <span>Upload new receipt</span>
                              </>
                            ) : (
                              <>
                                <BanknotesIcon className="h-3.5 w-3.5" />
                                <span>Pay now</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pay / Upload Receipt Modal */}
      {activeModalStatement && (
        <PayPlatformFeeModal
          statement={activeModalStatement}
          onClose={() => setActiveModalStatement(null)}
          onDone={handleModalDone}
        />
      )}
    </section>
  )
}
