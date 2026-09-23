import { useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import { getVenues } from '../../api/venues'
import AdminLayout from '../../components/layout/AdminLayout'
import { SkeletonRow } from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import { formatCurrency } from '../../utils/format'

export default function AdminVenuesPage() {
  const { data, loading, error } = useApi(useCallback(() => getVenues(), []))
  const venues = data?.data ?? []

  return (
    <AdminLayout>
      <div className="page-container">
        <div className="mb-8">
          <h1 className="page-title">Venues</h1>
          <p className="text-sm text-gray-500 mt-1">All badminton venues on the platform.</p>
        </div>

        <ErrorMessage message={error} className="mb-4" />

        <div className="table-wrapper">
          <div className="overflow-x-auto">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th>Venue Name</th>
                  <th>Area</th>
                  <th>Courts</th>
                  <th>Price / hr</th>
                  <th>Operating Hours</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5].map((n) => <SkeletonRow key={n} cols={6} />)
                ) : venues.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <EmptyState icon="🏟️" title="No venues found" />
                    </td>
                  </tr>
                ) : venues.map((v) => (
                  <tr key={v._id}>
                    <td>
                      <p className="font-semibold text-gray-900">{v.name}</p>
                    </td>
                    <td>
                      <span className="badge bg-primary-50 text-primary-700">{v.area}</span>
                    </td>
                    <td className="font-medium">{v.numberOfCourts}</td>
                    <td className="font-medium text-primary-700">{formatCurrency(v.pricePerHour)}</td>
                    <td className="text-gray-600 text-xs whitespace-nowrap">
                      {v.operatingHours.open} – {v.operatingHours.close}
                    </td>
                    <td className="text-gray-500 text-xs max-w-xs truncate">{v.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
