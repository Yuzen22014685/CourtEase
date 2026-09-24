import { useState, useCallback, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { getAdminVenues } from '../../api/admin'
import AdminLayout from '../../components/layout/AdminLayout'
import { SkeletonRow } from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'
import VenueFormModal from '../../components/admin/VenueFormModal'
import { formatCurrency, getImageUrl } from '../../utils/format'
import {
  PlusIcon,
  PencilSquareIcon,
  PhotoIcon,
  CheckCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

export default function AdminVenuesPage() {
  const { data, loading, error, refetch } = useApi(useCallback(() => getAdminVenues(), []))
  const venues = data?.data ?? []

  // Modal and action states
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  // Search and status filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'

  // Extract existing areas for the form dropdown
  const existingAreas = useMemo(() => {
    return Array.from(new Set(venues.map((v) => v.area).filter(Boolean)))
  }, [venues])

  // Filtered venues list
  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      const matchesSearch =
        !searchQuery ||
        v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.area?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.address?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && v.isActive !== false) ||
        (statusFilter === 'inactive' && v.isActive === false)

      return matchesSearch && matchesStatus
    })
  }, [venues, searchQuery, statusFilter])

  const handleOpenAdd = () => {
    setSelectedVenue(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (venue) => {
    setSelectedVenue(venue)
    setModalOpen(true)
  }

  const handleSaved = (savedVenue, isNew) => {
    refetch()
    setToastMessage(
      isNew
        ? `Venue "${savedVenue.name}" created successfully!`
        : `Venue "${savedVenue.name}" updated successfully!`
    )
  }

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Header with Title and Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title text-2xl font-bold text-gray-900">Venues</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage badminton venues, operating details, court allocations, and photo galleries.
            </p>
          </div>

          <button
            id="add-venue-btn"
            onClick={handleOpenAdd}
            className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add venue</span>
          </button>
        </div>

        {/* Success Toast */}
        {toastMessage && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-500 hover:text-emerald-800 p-0.5 rounded"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <ErrorMessage message={error} className="mb-4" />

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by venue name, area, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 w-full text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              All ({venues.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'active'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Active ({venues.filter((v) => v.isActive !== false).length})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Inactive ({venues.filter((v) => v.isActive === false).length})
            </button>
          </div>
        </div>

        {/* Venues Table */}
        <div className="table-wrapper">
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Venue Name</th>
                  <th>Area</th>
                  <th>Courts</th>
                  <th>Price / hr</th>
                  <th>Operating Hours</th>
                  <th>Photos</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5].map((n) => <SkeletonRow key={n} cols={8} />)
                ) : filteredVenues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        icon="🏟️"
                        title={searchQuery || statusFilter !== 'all' ? 'No matching venues' : 'No venues found'}
                        description={
                          searchQuery || statusFilter !== 'all'
                            ? 'Try clearing your search query or status filter.'
                            : 'Click "Add venue" to create your first venue.'
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredVenues.map((v) => {
                    const coverPhoto = v.photos?.[0]
                    const isVenueActive = v.isActive !== false

                    return (
                      <tr key={v._id} className="hover:bg-gray-50/70 transition-colors">
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                              {coverPhoto ? (
                                <img
                                  src={getImageUrl(coverPhoto)}
                                  alt={v.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                    e.target.nextSibling.style.display = 'flex'
                                  }}
                                />
                              ) : null}
                              <div
                                className={`w-full h-full ${
                                  coverPhoto ? 'hidden' : 'flex'
                                } items-center justify-center text-gray-400`}
                              >
                                <PhotoIcon className="h-5 w-5" />
                              </div>
                            </div>

                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 text-sm truncate">{v.name}</p>
                              <p className="text-gray-400 text-xs truncate max-w-xs">{v.address}</p>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="badge bg-primary-50 text-primary-700">{v.area}</span>
                        </td>

                        <td className="font-medium text-gray-900">{v.numberOfCourts}</td>

                        <td className="font-semibold text-primary-700">
                          {formatCurrency(v.pricePerHour)}
                        </td>

                        <td className="text-gray-600 text-xs whitespace-nowrap">
                          {v.operatingHours?.open} – {v.operatingHours?.close}
                        </td>

                        <td>
                          <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                            <PhotoIcon className="h-3.5 w-3.5 text-gray-400" />
                            {v.photos?.length || 0}
                          </span>
                        </td>

                        <td>
                          <Badge
                            status={isVenueActive ? 'active' : 'inactive'}
                            label={isVenueActive ? 'Active' : 'Inactive'}
                          />
                        </td>

                        <td className="text-right">
                          <button
                            id={`edit-venue-${v._id}`}
                            onClick={() => handleOpenEdit(v)}
                            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                          >
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Venue Modal */}
      <VenueFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        venue={selectedVenue}
        onSaved={handleSaved}
        existingAreas={existingAreas}
      />
    </AdminLayout>
  )
}
