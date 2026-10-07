import { useState, useEffect, useCallback } from 'react'
import { useOwnerVenue } from '../../context/OwnerVenueContext'
import {
  getShopItems,
  createShopItem,
  updateShopItem,
  deleteShopItem,
} from '../../api/admin'
import { formatCurrency } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import EmptyState from '../../components/ui/EmptyState'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ShoppingBagIcon,
  ClockIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline'

const initialFormState = {
  name: '',
  category: 'product',
  price: '',
  description: '',
  notePrompt: '',
  readyInfo: '',
}

export default function ShopPage() {
  const { selectedVenue } = useOwnerVenue()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState(initialFormState)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)

  const [deletingItem, setDeletingItem] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const fetchItems = useCallback(async () => {
    if (!selectedVenue?._id) {
      setItems([])
      setLoading(false)
      return
    }
    try {
      setPageError(null)
      const res = await getShopItems(selectedVenue._id)
      setItems(res.data?.data || [])
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to load shop items')
    } finally {
      setLoading(false)
    }
  }, [selectedVenue?._id])

  useEffect(() => {
    setLoading(true)
    fetchItems()
  }, [fetchItems])

  const handleOpenAdd = () => {
    setModalMode('create')
    setEditingItem(null)
    setFormData(initialFormState)
    setModalError(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item) => {
    setModalMode('edit')
    setEditingItem(item)
    setFormData({
      name: item.name || '',
      category: item.category || 'product',
      price: item.price !== undefined ? String(item.price) : '',
      description: item.description || '',
      notePrompt: item.notePrompt || '',
      readyInfo: item.readyInfo || '',
    })
    setModalError(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (formSubmitting) return
    setIsModalOpen(false)
    setEditingItem(null)
    setModalError(null)
  }

  const handleToggleAvailable = async (item) => {
    if (!selectedVenue?._id || togglingId === item._id) return
    setTogglingId(item._id)
    const newStatus = !item.isAvailable

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i._id === item._id ? { ...i, isAvailable: newStatus } : i))
    )

    try {
      await updateShopItem(selectedVenue._id, item._id, { isAvailable: newStatus })
    } catch (err) {
      // Rollback on error
      setItems((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, isAvailable: item.isAvailable } : i))
      )
      setPageError(err.response?.data?.message || 'Failed to update item availability')
    } finally {
      setTogglingId(null)
    }
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!selectedVenue?._id) return

    setModalError(null)
    setFormSubmitting(true)

    const payload = {
      name: formData.name.trim(),
      category: formData.category,
      price: parseFloat(formData.price),
      description: formData.description.trim(),
      notePrompt: formData.category === 'service' ? formData.notePrompt.trim() : '',
      readyInfo: formData.category === 'service' ? formData.readyInfo.trim() : '',
    }

    try {
      if (modalMode === 'edit' && editingItem) {
        await updateShopItem(selectedVenue._id, editingItem._id, payload)
      } else {
        await createShopItem(selectedVenue._id, payload)
      }
      setIsModalOpen(false)
      await fetchItems()
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save shop item')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingItem || !selectedVenue?._id) return
    setIsDeleting(true)
    try {
      await deleteShopItem(selectedVenue._id, deletingItem._id)
      setDeletingItem(null)
      await fetchItems()
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to delete item')
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center items-center min-h-[300px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Shop</h1>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl leading-relaxed">
            Items players can add to their court booking. Paid together with the booking, collected at your venue.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn-primary self-start sm:self-auto"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Add item</span>
        </button>
      </div>

      {pageError && (
        <ErrorMessage
          message={pageError}
          className="animate-fadeIn"
        />
      )}

      {/* ── Shop Items Content ── */}
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBagIcon className="h-8 w-8 text-gray-400" />}
          title="No items yet"
          description="No items yet — add drinks, shuttlecocks or services like racket stringing."
          action={
            <button
              type="button"
              onClick={handleOpenAdd}
              className="btn-primary"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add item</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {items.map((item) => (
            <div
              key={item._id}
              className="card p-5 flex flex-col justify-between transition-all hover:shadow-card-hover"
            >
              {/* Card Top: Details */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <Badge
                      status={item.category === 'service' ? 'maintenance' : 'paid'}
                      label={item.category === 'service' ? 'Service' : 'Product'}
                    />
                    {!item.isAvailable && (
                      <Badge
                        status="rejected"
                        label="Sold out"
                      />
                    )}
                  </div>
                </div>

                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(item.price)}
                </div>

                {item.description ? (
                  <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No description provided.</p>
                )}

                {/* Service Details */}
                {item.category === 'service' && (item.notePrompt || item.readyInfo) && (
                  <div className="pt-3 border-t border-gray-100 space-y-1.5">
                    {item.notePrompt && (
                      <div className="flex items-start gap-1.5 text-xs text-gray-500">
                        <ChatBubbleBottomCenterTextIcon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">
                          <strong className="font-medium text-gray-700">Question:</strong>{' '}
                          {item.notePrompt}
                        </span>
                      </div>
                    )}
                    {item.readyInfo && (
                      <div className="flex items-start gap-1.5 text-xs text-gray-500">
                        <ClockIcon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">
                          <strong className="font-medium text-gray-700">Ready time:</strong>{' '}
                          {item.readyInfo}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card Bottom: Toggle & Actions */}
              <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between gap-2">
                {/* Available toggle */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.isAvailable}
                    aria-label={`Toggle availability for ${item.name}`}
                    disabled={togglingId === item._id}
                    onClick={() => handleToggleAvailable(item)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      item.isAvailable ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        item.isAvailable ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-medium text-gray-600 select-none">
                    {item.isAvailable ? 'Available' : 'Sold out'}
                  </span>
                </div>

                {/* Edit & Delete Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit item"
                    aria-label={`Edit ${item.name}`}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingItem(item)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete item"
                    aria-label={`Delete ${item.name}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalMode === 'edit' ? 'Edit Shop Item' : 'Add Shop Item'}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {modalError && (
            <ErrorMessage
              message={modalError}
              className="animate-fadeIn"
            />
          )}

          {/* Name */}
          <div>
            <label htmlFor="shop-item-name" className="label">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              id="shop-item-name"
              type="text"
              required
              maxLength={60}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. 100Plus (500ml)"
              className="input"
            />
          </div>

          {/* Category */}
          <fieldset className="space-y-1">
            <legend className="label">
              Category <span className="text-red-500">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.category === 'product'
                    ? 'border-primary-500 bg-primary-50/50 text-primary-900 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="item-category"
                  value="product"
                  checked={formData.category === 'product'}
                  onChange={() => setFormData({ ...formData, category: 'product' })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">Product</span>
              </label>
              <label
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.category === 'service'
                    ? 'border-primary-500 bg-primary-50/50 text-primary-900 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="item-category"
                  value="service"
                  checked={formData.category === 'service'}
                  onChange={() => setFormData({ ...formData, category: 'service' })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">Service</span>
              </label>
            </div>
          </fieldset>

          {/* Price */}
          <div>
            <label htmlFor="shop-item-price" className="label">
              Price (RM) <span className="text-red-500">*</span>
            </label>
            <input
              id="shop-item-price"
              type="number"
              required
              min="0"
              max="1000"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              className="input"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="shop-item-description" className="label">
              Description
            </label>
            <textarea
              id="shop-item-description"
              rows={2}
              maxLength={200}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description for players..."
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {formData.description.length}/200
            </p>
          </div>

          {/* Service-Specific Fields */}
          {formData.category === 'service' && (
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3.5">
              <div>
                <label htmlFor="shop-item-noteprompt" className="label">
                  Question for the player
                </label>
                <input
                  id="shop-item-noteprompt"
                  type="text"
                  maxLength={100}
                  value={formData.notePrompt}
                  onChange={(e) => setFormData({ ...formData, notePrompt: e.target.value })}
                  placeholder="e.g. String type and tension (lbs)"
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Prompt shown to players to enter custom details when adding this service.
                </p>
              </div>

              <div>
                <label htmlFor="shop-item-readyinfo" className="label">
                  Ready time
                </label>
                <input
                  id="shop-item-readyinfo"
                  type="text"
                  maxLength={60}
                  value={formData.readyInfo}
                  onChange={(e) => setFormData({ ...formData, readyInfo: e.target.value })}
                  placeholder="e.g. Ready in 2 days"
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Turnaround time information shown to players.
                </p>
              </div>
            </div>
          )}

          {/* Form Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={formSubmitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="btn-primary"
            >
              {formSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{modalMode === 'edit' ? 'Save Changes' : 'Add Item'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Delete Dialog ── */}
      <ConfirmDialog
        isOpen={Boolean(deletingItem)}
        title={deletingItem ? `Delete "${deletingItem.name}"?` : 'Delete Item'}
        message="Players will no longer see this item. Past bookings keep their record."
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeletingItem(null)
        }}
      />
    </div>
  )
}
