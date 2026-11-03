import { useState, useCallback, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { getOwners, createOwner, resendOwnerInvite, getAdminVenues } from '../../api/admin'
import AdminLayout from '../../components/layout/AdminLayout'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import SkeletonCard, { SkeletonRow } from '../../components/ui/SkeletonCard'
import { formatDateTime } from '../../utils/format'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'

export default function OwnersPage() {
  const { data, loading, error, refetch } = useApi(useCallback(() => getOwners(), []))
  const owners = data?.data ?? []

  // Toast / notification states
  const [toastMessage, setToastMessage] = useState(null)
  const [warningMessage, setWarningMessage] = useState(null)
  const [actionError, setActionError] = useState(null)

  // Search filter
  const [searchQuery, setSearchQuery] = useState('')

  // Resend invite state (tracks which owner ID is currently sending)
  const [resendingId, setResendingId] = useState(null)

  // Add owner modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedVenueIds, setSelectedVenueIds] = useState([])
  const [venuesList, setVenuesList] = useState([])
  const [loadingVenues, setLoadingVenues] = useState(false)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)

  // Filter owners by name, email, or assigned venue name
  const filteredOwners = useMemo(() => {
    if (!searchQuery.trim()) return owners
    const q = searchQuery.toLowerCase().trim()
    return owners.filter((o) => {
      const matchName = o.fullName?.toLowerCase().includes(q)
      const matchEmail = o.email?.toLowerCase().includes(q)
      const matchVenue = o.venues?.some((v) => v.name?.toLowerCase().includes(q))
      return matchName || matchEmail || matchVenue
    })
  }, [owners, searchQuery])

  // Open "Add owner" modal and load all venues
  const handleOpenAddModal = async () => {
    setFullName('')
    setEmail('')
    setSelectedVenueIds([])
    setModalError(null)
    setIsModalOpen(true)
    setLoadingVenues(true)
    try {
      const res = await getAdminVenues()
      setVenuesList(res.data?.data ?? [])
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to load venues.')
    } finally {
      setLoadingVenues(false)
    }
  }

  // Toggle venue selection in modal
  const handleToggleVenue = (venueId) => {
    setSelectedVenueIds((prev) =>
      prev.includes(venueId) ? prev.filter((id) => id !== venueId) : [...prev, venueId]
    )
  }

  // Submit "Add owner" form
  const handleCreateOwner = async (e) => {
    e.preventDefault()
    setModalError(null)

    if (!fullName.trim()) {
      setModalError('Full name is required.')
      return
    }
    if (!email.trim()) {
      setModalError('Email is required.')
      return
    }

    setModalSubmitting(true)
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        venueIds: selectedVenueIds,
      }
      const res = await createOwner(payload)
      setIsModalOpen(false)
      refetch()

      if (res.data?.emailSent === false) {
        setWarningMessage('Account created, but the invite email failed — use Resend invite.')
      } else {
        setToastMessage(`Venue owner "${fullName.trim()}" created and invite sent!`)
      }
    } catch (err) {
      // Surface exact server error message (400 validation, 409 duplicate email, etc.)
      setModalError(err.response?.data?.message || err.message || 'Failed to create venue owner.')
    } finally {
      setModalSubmitting(false)
    }
  }

  // Handle Resend Invite with 60-second cooldown
  const handleResendInvite = async (ownerId) => {
    setResendingId(ownerId)
    setActionError(null)
    setToastMessage(null)
    setWarningMessage(null)

    try {
      const res = await resendOwnerInvite(ownerId)
      if (res.data?.emailSent === false) {
        setWarningMessage('Failed to deliver invite email. Please try again later.')
      } else {
        setToastMessage('Invite email sent successfully!')
      }
    } catch (err) {
      // Surface exact server error message (429 cooldown, 404 not found, etc.)
      setActionError(err.response?.data?.message || err.message || 'Failed to resend invite.')
    } finally {
      setResendingId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="page-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title text-2xl font-bold text-gray-900">Venue Owners</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage venue owner accounts, send onboarding invites, and assign venues.
            </p>
          </div>

          <button
            type="button"
            id="add-owner-btn"
            onClick={handleOpenAddModal}
            className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add owner</span>
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
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-500 hover:text-emerald-800 p-0.5 rounded"
              aria-label="Dismiss message"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Warning Toast */}
        {warningMessage && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2 font-medium">
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0" />
              <span>{warningMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setWarningMessage(null)}
              className="text-amber-500 hover:text-amber-800 p-0.5 rounded"
              aria-label="Dismiss warning"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Action Error Banner */}
        {actionError && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2 font-medium">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-500 hover:text-red-800 p-0.5 rounded"
              aria-label="Dismiss error"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <ErrorMessage message={error} className="mb-4" />

        {/* Search bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by owner name, email, venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 w-full text-xs"
            />
          </div>
          <div className="text-xs text-gray-500 self-end sm:self-auto font-medium">
            Total owners: {owners.length}
          </div>
        </div>

        {/* Mobile Owners Cards */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            [1, 2, 3].map((n) => <SkeletonCard key={n} />)
          ) : filteredOwners.length === 0 ? (
            <div className="card p-6 text-center text-sm text-gray-400">
              {searchQuery
                ? 'No matching venue owners'
                : 'No venue owners found'}
            </div>
          ) : (
            filteredOwners.map((owner) => {
              const isResending = resendingId === owner._id

              return (
                <div key={owner._id} className="card p-4 space-y-3">
                  {/* Top row: avatar + name + email */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {owner.fullName?.charAt(0)?.toUpperCase() || 'O'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-sm truncate">
                        {owner.fullName}
                      </p>
                      <p className="text-xs text-gray-500 break-all">
                        {owner.email}
                      </p>
                    </div>
                  </div>

                  {/* Venues list */}
                  <div>
                    <span className="text-gray-400 block text-[10px] mb-1">Assigned Venues</span>
                    {owner.venues && owner.venues.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {owner.venues.map((v) => (
                          <span
                            key={v._id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200"
                          >
                            <BuildingOffice2Icon className="h-3 w-3 text-primary-500" />
                            <span>{v.name}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">None</span>
                    )}
                  </div>

                  {/* Added-date line */}
                  <p className="text-xs text-gray-400">
                    Added {formatDateTime(owner.createdAt)}
                  </p>

                  {/* Action area */}
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      id={`resend-invite-card-${owner._id}`}
                      type="button"
                      onClick={() => handleResendInvite(owner._id)}
                      disabled={isResending}
                      className="btn-secondary w-full text-xs py-1.5 px-3 inline-flex items-center justify-center gap-1.5"
                      title="Resend 72-hour onboarding invite email"
                    >
                      {isResending ? (
                        <>
                          <Spinner size="sm" />
                          <span>Sending…</span>
                        </>
                      ) : (
                        <>
                          <EnvelopeIcon className="h-3.5 w-3.5 text-gray-500" />
                          <span>Resend invite</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Owners Table */}
        <div className="hidden md:block">
        <div className="table-wrapper">
          <div className="overflow-x-auto">
            <table className="table min-w-[700px]">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Email</th>
                  <th>Assigned Venues</th>
                  <th>Added On</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4].map((n) => <SkeletonRow key={n} cols={5} />)
                ) : filteredOwners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12">
                      <EmptyState
                        icon="👥"
                        title={searchQuery ? 'No matching venue owners' : 'No venue owners found'}
                        description={
                          searchQuery
                            ? 'Try clearing your search query.'
                            : 'Click "Add owner" to register your first venue owner.'
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredOwners.map((owner) => {
                    const isResending = resendingId === owner._id

                    return (
                      <tr key={owner._id} className="hover:bg-gray-50/70 transition-colors">
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {owner.fullName?.charAt(0)?.toUpperCase() || 'O'}
                            </div>
                            <span className="font-semibold text-gray-900 text-sm">
                              {owner.fullName}
                            </span>
                          </div>
                        </td>

                        <td className="text-xs text-gray-600 font-mono">
                          {owner.email}
                        </td>

                        <td>
                          {owner.venues && owner.venues.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {owner.venues.map((v) => (
                                <span
                                  key={v._id}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200"
                                >
                                  <BuildingOffice2Icon className="h-3 w-3 text-primary-500" />
                                  <span>{v.name}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">None</span>
                          )}
                        </td>

                        <td className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDateTime(owner.createdAt)}
                        </td>

                        <td className="text-right">
                          <button
                            id={`resend-invite-${owner._id}`}
                            type="button"
                            onClick={() => handleResendInvite(owner._id)}
                            disabled={isResending}
                            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                            title="Resend 72-hour onboarding invite email"
                          >
                            {isResending ? (
                              <>
                                <Spinner size="sm" />
                                <span>Sending…</span>
                              </>
                            ) : (
                              <>
                                <EnvelopeIcon className="h-3.5 w-3.5 text-gray-500" />
                                <span>Resend invite</span>
                              </>
                            )}
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

      {/* Add Owner Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !modalSubmitting && setIsModalOpen(false)}
        title="Add Venue Owner"
        size="md"
      >
        <form onSubmit={handleCreateOwner} className="space-y-4">
          <ErrorMessage message={modalError} />

          {/* Full Name */}
          <div>
            <label htmlFor="owner-fullname" className="block text-xs font-semibold text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="owner-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Tan"
              className="input w-full text-sm"
              disabled={modalSubmitting}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="owner-email" className="block text-xs font-semibold text-gray-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="owner-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. owner@example.com"
              className="input w-full text-sm"
              disabled={modalSubmitting}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              An onboarding invite link will be emailed to this address with instructions to set a password.
            </p>
          </div>

          {/* Venue Assignment Checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Assign Venues (optional)
            </label>
            <p className="text-[11px] text-gray-500 mb-2">
              Select venues to assign to this owner. Selecting it will move the venue to this owner.
            </p>

            {loadingVenues ? (
              <div className="py-6 flex justify-center text-gray-400">
                <Spinner size="sm" />
              </div>
            ) : venuesList.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No venues found in system.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-gray-50/50">
                {venuesList.map((venue) => {
                  const isChecked = selectedVenueIds.includes(venue._id)
                  const hasCurrentOwner = Boolean(venue.owner?.fullName)

                  return (
                    <label
                      key={venue._id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                        isChecked ? 'bg-primary-50/80 border border-primary-200' : 'hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleVenue(venue._id)}
                        disabled={modalSubmitting}
                        className="rounded text-primary-600 focus:ring-primary-500 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-gray-900">{venue.name}</span>
                        {hasCurrentOwner && (
                          <span className="text-gray-400 ml-1.5 font-normal">
                            (currently: {venue.owner.fullName})
                          </span>
                        )}
                        <p className="text-[11px] text-gray-400">{venue.area}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={modalSubmitting}
              className="btn-secondary px-4 text-sm"
            >
              Cancel
            </button>
            <button
              id="submit-owner-btn"
              type="submit"
              disabled={modalSubmitting}
              className="btn-primary px-5 text-sm flex items-center gap-2"
            >
              {modalSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span>Creating…</span>
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4" />
                  <span>Create Owner</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  )
}
