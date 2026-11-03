import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useOwnerVenue } from '../../context/OwnerVenueContext'
import { useApi } from '../../hooks/useApi'
import { getAdminVenues } from '../../api/admin'
import AdminLayout from '../../components/layout/AdminLayout'
import SkeletonCard, { SkeletonRow } from '../../components/ui/SkeletonCard'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'
import VenueFormModal from '../../components/admin/VenueFormModal'
import { formatCurrency, getImageUrl, formatPriceRange } from '../../utils/format'
import {
  PlusIcon,
  PencilSquareIcon,
  PhotoIcon,
  CheckCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

export default function AdminVenuesPage({ noLayout = false }) {
  const { isAdmin, isOwner } = useAuth()
  const { refetchVenues } = useOwnerVenue()
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

  const singleOwnerVenue = isOwner && venues.length === 1

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
    if (isOwner) {
      refetchVenues({ silent: true })
    }
    setToastMessage(
      isNew
        ? `Venue "${savedVenue.name}" created successfully!`
        : `Venue "${savedVenue.name}" updated successfully!`
    )
  }

  const content = (
    <>
      <div className="page-container">
        {/* Header with Title and Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title text-2xl font-bold text-gray-900">
              {isOwner ? 'My Venue' : 'Venues'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isOwner
                ? 'Update your venue details, photos and court layout.'
                : 'Manage badminton venues, operating details, court allocations, and photo galleries.'}
            </p>
          </div>

          {!isOwner && (
            <button
              id="add-venue-btn"
              onClick={handleOpenAdd}
              className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add venue</span>
            </button>
          )}
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
        {!isOwner && (
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

            <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
              >
                All ({venues.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'active'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
              >
                Active ({venues.filter((v) => v.isActive !== false).length})
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'inactive'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
              >
                Inactive ({venues.filter((v) => v.isActive === false).length})
              </button>
            </div>
          </div>
        )}

        {singleOwnerVenue && (
          <OwnerVenueProfile
            venue={venues[0]}
            priceLabel={formatPriceRange(venues[0])}
            onEdit={handleOpenEdit}
          />
        )}

        {/* Mobile / Single Owner Cards */}
        <div className={singleOwnerVenue ? 'hidden' : 'space-y-3 md:hidden'}>
          {loading ? (
            [1, 2, 3].map((n) => <SkeletonCard key={n} />)
          ) : filteredVenues.length === 0 ? (
            <div className="card p-6 text-center text-sm text-gray-400">
              {searchQuery || statusFilter !== 'all' ? 'No matching venues' : 'No venues found'}
            </div>
          ) : (
            filteredVenues.map((v) => {
              const coverPhoto = v.photos?.[0]
              const isVenueActive = v.isActive !== false
              const hasPaymentDetails = Boolean(
                v.paymentInfo?.duitNowQr?.trim() ||
                (v.paymentInfo?.bankName?.trim() &&
                  v.paymentInfo?.accountName?.trim() &&
                  v.paymentInfo?.accountNumber?.trim())
              )

              return (
                <div key={v._id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="relative w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
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
                          className={`w-full h-full ${coverPhoto ? 'hidden' : 'flex'
                            } items-center justify-center text-gray-400`}
                        >
                          <PhotoIcon className="h-5 w-5" />
                        </div>
                        {v.photos?.length > 0 && (
                          <span className="absolute bottom-0.5 right-0.5 text-[10px] bg-black/60 text-white rounded px-1 leading-tight font-medium">
                            {v.photos.length}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <p className="font-bold text-gray-900 text-sm truncate" title={v.name}>{v.name}</p>
                          {!hasPaymentDetails && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0 whitespace-nowrap"
                              title="No payment details configured"
                            >
                              No payment details
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2 mt-0.5" title={v.address}>{v.address}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Badge
                        status={isVenueActive ? 'active' : 'inactive'}
                        label={isVenueActive ? 'Active' : 'Inactive'}
                      />
                    </div>
                  </div>

                  {isAdmin && (
                    <p className="text-xs text-gray-600">
                      Owner: {v.owner?.fullName || '—'}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Area</span>
                      <span className="badge bg-primary-50 text-primary-700 whitespace-nowrap">{v.area}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Courts</span>
                      <span className="font-medium text-gray-900">{v.numberOfCourts}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Price / hr</span>
                      <span className="font-semibold text-primary-700">{formatPriceRange(v)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600">
                    Hours: {v.operatingHours?.open} – {v.operatingHours?.close}
                  </p>

                  <div className="pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      id={`edit-venue-card-${v._id}`}
                      onClick={() => handleOpenEdit(v)}
                      className="btn-secondary w-full text-xs py-1.5 px-3 inline-flex items-center justify-center gap-1.5"
                    >
                      <PencilSquareIcon className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Venues Table */}
        <div className={singleOwnerVenue ? 'hidden' : 'hidden md:block'}>
          <div className="table-wrapper">
            <div className="overflow-x-auto">
              <table className="table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Venue Name</th>
                    <th className="whitespace-nowrap">Area</th>
                    {isAdmin && <th className="whitespace-nowrap">Owner</th>}
                    <th className="whitespace-nowrap">Courts</th>
                    <th className="whitespace-nowrap">Price / hr</th>
                    <th className="whitespace-nowrap">Operating Hours</th>
                    <th className="whitespace-nowrap">Status</th>
                    <th className="text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3, 4, 5].map((n) => <SkeletonRow key={n} cols={isAdmin ? 8 : 7} />)
                  ) : filteredVenues.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="py-12">
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
                      const hasPaymentDetails = Boolean(
                        v.paymentInfo?.duitNowQr?.trim() ||
                        (v.paymentInfo?.bankName?.trim() &&
                          v.paymentInfo?.accountName?.trim() &&
                          v.paymentInfo?.accountNumber?.trim())
                      )

                      return (
                        <tr key={v._id} className="hover:bg-gray-50/70 transition-colors">
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="relative w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
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
                                  className={`w-full h-full ${coverPhoto ? 'hidden' : 'flex'
                                    } items-center justify-center text-gray-400`}
                                >
                                  <PhotoIcon className="h-5 w-5" />
                                </div>
                                {v.photos?.length > 0 && (
                                  <span className="absolute bottom-0.5 right-0.5 text-[10px] bg-black/60 text-white rounded px-1 leading-tight font-medium">
                                    {v.photos.length}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1 max-w-[16rem] lg:max-w-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="font-semibold text-gray-900 text-sm truncate" title={v.name}>{v.name}</p>
                                  {!hasPaymentDetails && (
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0 whitespace-nowrap"
                                      title="No payment details configured"
                                    >
                                      No payment details
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-400 text-xs truncate" title={v.address}>{v.address}</p>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap">
                            <span className="badge bg-primary-50 text-primary-700 whitespace-nowrap">{v.area}</span>
                          </td>

                          {isAdmin && (
                            <td className="text-xs text-gray-700 font-medium whitespace-nowrap">
                              {v.owner?.fullName || '—'}
                            </td>
                          )}

                          <td className="font-medium text-gray-900 whitespace-nowrap">{v.numberOfCourts}</td>

                          <td className="font-semibold text-primary-700 whitespace-nowrap">
                            {formatPriceRange(v)}
                          </td>

                          <td className="text-gray-600 text-xs whitespace-nowrap">
                            {v.operatingHours?.open} – {v.operatingHours?.close}
                          </td>

                          <td className="whitespace-nowrap">
                            <Badge
                              status={isVenueActive ? 'active' : 'inactive'}
                              label={isVenueActive ? 'Active' : 'Inactive'}
                            />
                          </td>

                          <td className="text-right whitespace-nowrap">
                            <button
                              type="button"
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

      </div>

      {/* Add / Edit Venue Modal */}
      <VenueFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        venue={selectedVenue}
        onSaved={handleSaved}
        existingAreas={existingAreas}
      />
    </>
  )

  if (noLayout) return content
  return <AdminLayout>{content}</AdminLayout>
}

function OwnerVenueProfile({ venue: v, priceLabel, onEdit }) {
  const coverPhoto = v.photos?.[0]
  const isVenueActive = v.isActive !== false
  const hasPaymentDetails = Boolean(
    v.paymentInfo?.duitNowQr?.trim() ||
    (v.paymentInfo?.bankName?.trim() &&
      v.paymentInfo?.accountName?.trim() &&
      v.paymentInfo?.accountNumber?.trim())
  )

  return (
    <div className="card overflow-hidden max-w-4xl md:flex">
      <div className="relative w-full h-44 md:w-80 md:h-auto md:min-h-[15rem] bg-gray-100 shrink-0 flex items-center justify-center">
        <PhotoIcon className="h-10 w-10 text-gray-300" />
        {coverPhoto && (
          <img
            src={getImageUrl(coverPhoto)}
            alt={v.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
        {v.photos?.length > 0 && (
          <span className="absolute bottom-2 right-2 text-xs bg-black/60 text-white rounded px-2 py-0.5 font-medium">
            {v.photos.length} photo{v.photos.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 p-5 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{v.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{v.address}</p>
          </div>
          <div className="shrink-0">
            <Badge
              status={isVenueActive ? 'active' : 'inactive'}
              label={isVenueActive ? 'Active' : 'Inactive'}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100 text-sm">
          <div>
            <span className="text-gray-400 block text-xs mb-1">Area</span>
            <span className="badge bg-primary-50 text-primary-700 whitespace-nowrap">{v.area}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-xs mb-1">Courts</span>
            <span className="font-semibold text-gray-900">{v.numberOfCourts}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-xs mb-1">Price / hr</span>
            <span className="font-semibold text-primary-700">{priceLabel}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-xs mb-1">Opening hours</span>
            <span className="font-semibold text-gray-900">
              {v.operatingHours?.open} – {v.operatingHours?.close}
            </span>
          </div>
        </div>

        <div
          className={`rounded-lg px-3 py-2 text-xs border ${hasPaymentDetails
              ? 'bg-primary-50 text-primary-800 border-primary-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
        >
          {hasPaymentDetails
            ? '✓ Payment details added — players see your bank account / DuitNow QR when they check out.'
            : 'Payment details missing — players cannot pay you until you add a bank account or DuitNow QR (Edit venue details).'}
        </div>

        <button
          type="button"
          id="edit-venue-profile"
          onClick={() => onEdit(v)}
          className="btn-primary w-full sm:w-auto"
        >
          <PencilSquareIcon className="h-4 w-4" />
          <span>Edit venue details</span>
        </button>
      </div>
    </div>
  )
}
