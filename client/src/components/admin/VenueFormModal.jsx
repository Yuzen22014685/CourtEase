import { useState, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import Spinner from '../ui/Spinner'
import ErrorMessage from '../ui/ErrorMessage'
import { getImageUrl } from '../../utils/format'
import {
  createVenue,
  updateVenue,
  uploadVenuePhotos,
  deleteVenuePhoto,
  reorderVenuePhotos,
  uploadCourtLayout,
  deleteCourtLayout,
} from '../../api/admin'
import {
  PlusIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  TrashIcon,
  PhotoIcon,
  CheckIcon,
  InformationCircleIcon,
  MapIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'

const DEFAULT_AREAS = [
  'Bayan Lepas',
  'Georgetown',
  'Bukit Mertajam',
  'Tanjung Bungah',
  'Jelutong',
  'Butterworth',
  'Seberang Jaya',
]

const FACILITY_SUGGESTIONS = [
  'Air Conditioning',
  'Parking',
  'Shower',
  'Toilet',
  'Water Dispenser',
  'Pro Shop',
  'Lockers',
  'Cafe',
  'Prayer Room',
  'Vending Machine',
  'Wi-Fi',
]

const toMinutes = (timeStr) => {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export default function VenueFormModal({
  isOpen,
  onClose,
  venue = null,
  onSaved,
  existingAreas = [],
}) {
  const isEdit = Boolean(venue?._id)
  const [activeTab, setActiveTab] = useState('details') // 'details' | 'photos'

  // Form fields
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [customArea, setCustomArea] = useState('')
  const [isCustomArea, setIsCustomArea] = useState(false)
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [openTime, setOpenTime] = useState('08:00')
  const [closeTime, setCloseTime] = useState('22:00')
  const [pricePerHour, setPricePerHour] = useState('25')
  const [numberOfCourts, setNumberOfCourts] = useState('4')
  const [facilities, setFacilities] = useState([])
  const [newFacilityInput, setNewFacilityInput] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Photos state (for edit mode)
  const [currentVenueId, setCurrentVenueId] = useState(null)
  const [photos, setPhotos] = useState([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [photoError, setPhotoError] = useState(null)
  const [photoToDelete, setPhotoToDelete] = useState(null)
  const fileInputRef = useRef(null)

  // Layout image state
  const [layoutImage, setLayoutImage] = useState(null)
  const [uploadingLayout, setUploadingLayout] = useState(false)
  const [layoutError, setLayoutError] = useState(null)
  const layoutFileInputRef = useRef(null)

  // Form submit state & scroll ref
  const formTopRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [successNotice, setSuccessNotice] = useState(null)

  // Merge areas
  const allKnownAreas = Array.from(new Set([...DEFAULT_AREAS, ...existingAreas])).filter(Boolean)

  // Initialize or reset form state whenever venue or isOpen changes
  useEffect(() => {
    if (!isOpen) {
      setFormError(null)
      setPhotoError(null)
      setLayoutError(null)
      setSuccessNotice(null)
      setActiveTab('details')
      return
    }

    if (venue) {
      setCurrentVenueId(venue._id)
      setName(venue.name || '')
      if (allKnownAreas.includes(venue.area)) {
        setArea(venue.area)
        setIsCustomArea(false)
        setCustomArea('')
      } else if (venue.area) {
        setArea('__custom__')
        setIsCustomArea(true)
        setCustomArea(venue.area)
      } else {
        setArea(allKnownAreas[0] || 'Bayan Lepas')
        setIsCustomArea(false)
        setCustomArea('')
      }

      setAddress(venue.address || '')
      setDescription(venue.description || '')
      setPhone(venue.phone || '')
      setOpenTime(venue.operatingHours?.open || '08:00')
      setCloseTime(venue.operatingHours?.close || '22:00')
      setPricePerHour(String(venue.pricePerHour ?? 25))
      setNumberOfCourts(String(venue.numberOfCourts ?? 4))
      setFacilities(venue.facilities || [])
      setLat(venue.location?.lat != null ? String(venue.location.lat) : '')
      setLng(venue.location?.lng != null ? String(venue.location.lng) : '')
      setIsActive(venue.isActive !== false)
      setPhotos(venue.photos || [])
      setLayoutImage(venue.layoutImage || null)
    } else {
      setCurrentVenueId(null)
      setName('')
      setArea(allKnownAreas[0] || 'Bayan Lepas')
      setIsCustomArea(false)
      setCustomArea('')
      setAddress('')
      setDescription('')
      setPhone('')
      setOpenTime('08:00')
      setCloseTime('22:00')
      setPricePerHour('25')
      setNumberOfCourts('4')
      setFacilities(['Air Conditioning', 'Shower', 'Parking', 'Toilet'])
      setLat('')
      setLng('')
      setIsActive(true)
      setPhotos([])
      setLayoutImage(null)
    }
  }, [isOpen, venue])

  // Area select handler
  const handleAreaSelect = (e) => {
    const val = e.target.value
    if (val === '__custom__') {
      setIsCustomArea(true)
      setArea('__custom__')
    } else {
      setIsCustomArea(false)
      setArea(val)
      setCustomArea('')
    }
  }

  // Facility tag helpers
  const handleAddFacility = () => {
    const trimmed = newFacilityInput.trim()
    if (!trimmed) return
    if (!facilities.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      setFacilities([...facilities, trimmed])
    }
    setNewFacilityInput('')
  }

  const handleFacilityKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddFacility()
    }
  }

  const handleRemoveFacility = (index) => {
    setFacilities(facilities.filter((_, i) => i !== index))
  }

  const toggleFacilitySuggestion = (fac) => {
    if (facilities.some((f) => f.toLowerCase() === fac.toLowerCase())) {
      setFacilities(facilities.filter((f) => f.toLowerCase() !== fac.toLowerCase()))
    } else {
      setFacilities([...facilities, fac])
    }
  }

  // Submit venue form (details)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setSuccessNotice(null)

    const triggerError = (msg) => {
      setFormError(msg)
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Validation
    const resolvedArea = isCustomArea ? customArea.trim() : area.trim()
    if (!name.trim()) {
      triggerError('Venue name is required.')
      return
    }
    if (!resolvedArea) {
      triggerError('Venue area is required.')
      return
    }
    if (!address.trim()) {
      triggerError('Address is required.')
      return
    }

    const openMin = toMinutes(openTime)
    const closeMin = toMinutes(closeTime)
    if (openMin === null || closeMin === null) {
      triggerError('Opening and closing times must be in valid HH:MM format.')
      return
    }
    if (closeMin <= openMin) {
      triggerError('Closing time must be after opening time.')
      return
    }

    const price = Number(pricePerHour)
    if (isNaN(price) || price <= 0) {
      triggerError('Price per hour must be a valid number greater than 0.')
      return
    }

    const courts = parseInt(numberOfCourts, 10)
    if (isNaN(courts) || courts < 1 || courts > 20) {
      triggerError('Number of courts must be between 1 and 20.')
      return
    }
    if (isEdit && venue && courts < venue.numberOfCourts) {
      triggerError('Courts cannot be removed because they may have bookings.')
      return
    }

    if (description && description.length > 1000) {
      triggerError('Description cannot exceed 1000 characters.')
      return
    }

    let locationPayload = undefined
    if (lat !== '' || lng !== '') {
      const latNum = Number(lat)
      const lngNum = Number(lng)
      if (isNaN(latNum) || latNum < -90 || latNum > 90 || isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        triggerError('Latitude must be between -90 and 90, and longitude between -180 and 180.')
        return
      }
      locationPayload = { lat: latNum, lng: lngNum }
    } else if (isEdit) {
      locationPayload = null // will clear location
    }

    const payload = {
      name: name.trim(),
      area: resolvedArea,
      address: address.trim(),
      description: description.trim(),
      phone: phone.trim(),
      operatingHours: { open: openTime, close: closeTime },
      pricePerHour: price,
      numberOfCourts: courts,
      facilities,
      isActive,
      location: locationPayload,
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        const res = await updateVenue(venue._id, payload)
        const updated = res.data.data
        onSaved?.(updated, false)
        onClose?.()
      } else {
        const res = await createVenue(payload)
        const created = res.data.data
        onSaved?.(created, true)
        onClose?.()
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save venue.')
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Court Layout management methods ────────────────────────────────────────
  const handleLayoutUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLayoutError(null)

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setLayoutError('Only JPG and PNG images are allowed for court layout.')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLayoutError('Layout image exceeds the 5MB size limit.')
      e.target.value = ''
      return
    }

    const targetId = currentVenueId || venue?._id
    if (!targetId) {
      setLayoutError('Please save the venue details before uploading a court layout.')
      return
    }

    const formData = new FormData()
    formData.append('layout', file)

    setUploadingLayout(true)
    try {
      const res = await uploadCourtLayout(targetId, formData)
      const newLayout = res.data.layoutImage
      setLayoutImage(newLayout)
      setSuccessNotice('Court layout image uploaded successfully!')
      onSaved?.({ ...(venue || {}), _id: targetId, layoutImage: newLayout }, false)
      if (layoutFileInputRef.current) layoutFileInputRef.current.value = ''
    } catch (err) {
      setLayoutError(err.response?.data?.message || 'Failed to upload court layout.')
    } finally {
      setUploadingLayout(false)
    }
  }

  const handleDeleteLayout = async () => {
    const targetId = currentVenueId || venue?._id
    if (!targetId) return
    setLayoutError(null)

    setUploadingLayout(true)
    try {
      await deleteCourtLayout(targetId)
      setLayoutImage(null)
      setSuccessNotice('Court layout image removed.')
      onSaved?.({ ...(venue || {}), _id: targetId, layoutImage: null }, false)
    } catch (err) {
      setLayoutError(err.response?.data?.message || 'Failed to remove court layout.')
    } finally {
      setUploadingLayout(false)
    }
  }

  // ── Photo management methods ───────────────────────────────────────────────
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setPhotoError(null)

    if (files.length > 5) {
      setPhotoError('You can upload a maximum of 5 photos at a time.')
      e.target.value = ''
      return
    }

    if (photos.length + files.length > 10) {
      setPhotoError(
        `Maximum 10 photos allowed per venue. You already have ${photos.length}, can only upload ${10 - photos.length} more.`
      )
      e.target.value = ''
      return
    }

    // Validate size and mime type
    for (const f of files) {
      if (!['image/jpeg', 'image/png'].includes(f.type)) {
        setPhotoError('Only JPG and PNG images are allowed.')
        e.target.value = ''
        return
      }
      if (f.size > 5 * 1024 * 1024) {
        setPhotoError(`File "${f.name}" exceeds the 5MB size limit.`)
        e.target.value = ''
        return
      }
    }

    const formData = new FormData()
    files.forEach((f) => formData.append('photos', f))

    const targetId = currentVenueId || venue?._id
    if (!targetId) {
      setPhotoError('Please save the venue details before uploading photos.')
      return
    }

    setUploadingPhotos(true)
    try {
      const res = await uploadVenuePhotos(targetId, formData)
      const newPhotoList = res.data.data
      setPhotos(newPhotoList)
      setSuccessNotice('Photos uploaded successfully!')
      onSaved?.({ ...(venue || {}), _id: targetId, photos: newPhotoList }, false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setPhotoError(err.response?.data?.message || 'Failed to upload photos.')
    } finally {
      setUploadingPhotos(false)
    }
  }

  const handleMovePhoto = async (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= photos.length) return

    const newOrder = [...photos]
    const temp = newOrder[index]
    newOrder[index] = newOrder[targetIndex]
    newOrder[targetIndex] = temp

    setPhotos(newOrder)
    const targetId = currentVenueId || venue?._id
    if (!targetId) return

    try {
      await reorderVenuePhotos(targetId, newOrder)
      onSaved?.({ ...(venue || {}), _id: targetId, photos: newOrder }, false)
    } catch (err) {
      setPhotoError('Failed to reorder photos on server.')
      // revert
      setPhotos(photos)
    }
  }

  const handleConfirmDeletePhoto = async () => {
    if (!photoToDelete) return
    const photo = photoToDelete
    setPhotoToDelete(null)
    setPhotoError(null)

    const targetId = currentVenueId || venue?._id
    if (!targetId) return

    try {
      const res = await deleteVenuePhoto(targetId, photo)
      const updatedPhotos = res.data.data
      setPhotos(updatedPhotos)
      onSaved?.({ ...(venue || {}), _id: targetId, photos: updatedPhotos }, false)
      setSuccessNotice('Photo removed.')
    } catch (err) {
      setPhotoError(err.response?.data?.message || 'Failed to delete photo.')
    }
  }

  const effectiveVenueId = currentVenueId || venue?._id

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? `Edit Venue: ${venue?.name || ''}` : 'Add New Venue'}
        size="2xl"
      >
        <div className="space-y-5">
          {/* Tabs for edit mode or when venue is created */}
          {effectiveVenueId && (
            <div className="flex border-b border-gray-200 gap-6 text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('details')
                  setFormError(null)
                }}
                className={`pb-3 px-1 border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-primary-600 text-primary-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Venue Details
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('photos')
                  setPhotoError(null)
                }}
                className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'photos'
                    ? 'border-primary-600 text-primary-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <PhotoIcon className="h-4 w-4" />
                Photos ({photos.length}/10)
              </button>
            </div>
          )}

          {/* Success Banner */}
          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
              <button
                onClick={() => setSuccessNotice(null)}
                className="text-emerald-500 hover:text-emerald-700"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div ref={formTopRef} />
              <ErrorMessage message={formError} />

              {/* Name & Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Venue Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="venue-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Bayan Lepas Sports Arena"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Area <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="venue-area-select"
                    value={isCustomArea ? '__custom__' : area}
                    onChange={handleAreaSelect}
                    className="input w-full"
                  >
                    {allKnownAreas.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                    <option value="__custom__">+ Add new area...</option>
                  </select>

                  {isCustomArea && (
                    <input
                      id="venue-custom-area"
                      type="text"
                      required
                      value={customArea}
                      onChange={(e) => setCustomArea(e.target.value)}
                      placeholder="Enter new area name"
                      className="input w-full mt-2"
                    />
                  )}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="venue-address"
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. No. 12, Jalan Lapangan Terbang Lama, Bayan Lepas, 11900 Penang"
                  className="input w-full resize-none"
                />
              </div>

              {/* Description & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-700">Description</label>
                    <span className="text-[11px] text-gray-400">{description.length}/1000</span>
                  </div>
                  <textarea
                    id="venue-description"
                    maxLength={1000}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe venue highlights, court surface type, amenities, parking info..."
                    className="input w-full resize-none"
                  />
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Phone Number (optional)
                    </label>
                    <input
                      id="venue-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 04-641 2345"
                      className="input w-full"
                    />
                  </div>

                  {/* Active Toggle Switch */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl mt-3 sm:mt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800">Active Venue</span>
                      <button
                        type="button"
                        id="venue-active-toggle"
                        role="switch"
                        aria-checked={isActive}
                        onClick={() => setIsActive(!isActive)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isActive ? 'bg-primary-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {isActive
                        ? 'Visible and open for bookings'
                        : 'Hidden from players (cannot be booked)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Operating Hours & Pricing & Courts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Opening Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="venue-open-time"
                    type="time"
                    required
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="input w-full text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Closing Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="venue-close-time"
                    type="time"
                    required
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    className="input w-full text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Price / Hr (RM) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="venue-price"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={pricePerHour}
                    onChange={(e) => setPricePerHour(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Courts <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="venue-courts"
                    type="number"
                    min={isEdit && venue ? venue.numberOfCourts : 1}
                    max="20"
                    required
                    value={numberOfCourts}
                    onChange={(e) => setNumberOfCourts(e.target.value)}
                    className="input w-full"
                  />
                  {isEdit && venue && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Min {venue.numberOfCourts} (cannot decrease)
                    </p>
                  )}
                </div>
              </div>

              {/* Coordinates (Location lat, lng) */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Location Coordinates (optional)
                  </label>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <InformationCircleIcon className="h-3.5 w-3.5 text-gray-400" />
                    Right-click venue in Google Maps to copy coordinates
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      id="venue-lat"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="Latitude (e.g. 5.297)"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <input
                      id="venue-lng"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="Longitude (e.g. 100.286)"
                      className="input w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Facilities as interactive tag chips */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Facilities & Amenities
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    id="venue-facility-input"
                    type="text"
                    value={newFacilityInput}
                    onChange={(e) => setNewFacilityInput(e.target.value)}
                    onKeyDown={handleFacilityKeyDown}
                    placeholder="Type a facility and press Enter..."
                    className="input flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddFacility}
                    className="btn-secondary text-xs px-3 whitespace-nowrap"
                  >
                    <PlusIcon className="h-4 w-4" /> Add
                  </button>
                </div>

                {/* Selected tag chips */}
                {facilities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {facilities.map((fac, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200"
                      >
                        {fac}
                        <button
                          type="button"
                          onClick={() => handleRemoveFacility(idx)}
                          className="hover:text-primary-900 focus:outline-none"
                          aria-label={`Remove ${fac}`}
                        >
                          <XMarkIcon className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-2">No facilities added yet.</p>
                )}

                {/* Quick suggestions */}
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                  <span className="font-medium mr-1">Suggestions:</span>
                  {FACILITY_SUGGESTIONS.map((fac) => {
                    const isSelected = facilities.some(
                      (f) => f.toLowerCase() === fac.toLowerCase()
                    )
                    return (
                      <button
                        type="button"
                        key={fac}
                        onClick={() => toggleFacilitySuggestion(fac)}
                        className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                          isSelected
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {fac}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Modal footer actions */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary px-4 text-sm"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    id="save-venue-btn"
                    type="submit"
                    disabled={submitting}
                    className="btn-primary px-5 text-sm flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{isEdit ? 'Save Changes' : 'Create Venue'}</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: PHOTOS */}
          {activeTab === 'photos' && (
            <div className="space-y-4">
              <ErrorMessage message={photoError} />

              {/* Upload control bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Venue Photo Gallery
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {photos.length} of 10 photos used · First photo is the venue cover
                  </p>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhotos || photos.length >= 10}
                    className="hidden"
                    id="venue-photo-input"
                  />
                  <label
                    htmlFor="venue-photo-input"
                    className={`btn-primary text-xs px-3.5 py-2 inline-flex items-center gap-1.5 cursor-pointer ${
                      photos.length >= 10 || uploadingPhotos ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    {uploadingPhotos ? (
                      <>
                        <Spinner size="sm" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        <span>Upload Photos</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Photos grid */}
              {photos.length === 0 ? (
                <div className="py-12 px-4 border-2 border-dashed border-gray-200 rounded-xl text-center">
                  <PhotoIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700">No photos added yet</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Upload up to 10 high-quality photos (JPG or PNG, max 5MB each) to showcase your badminton courts.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {photos.map((photo, index) => {
                    const isCover = index === 0
                    const fullSrc = getImageUrl(photo)

                    return (
                      <div
                        key={photo}
                        className={`relative group rounded-xl overflow-hidden border bg-gray-50 flex flex-col shadow-sm ${
                          isCover ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-200'
                        }`}
                      >
                        {/* Cover badge */}
                        {isCover && (
                          <span className="absolute top-2 left-2 z-10 bg-primary-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow">
                            Cover
                          </span>
                        )}

                        {/* Image preview */}
                        <div className="aspect-[4/3] w-full bg-gray-100 overflow-hidden">
                          <img
                            src={fullSrc}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null
                              e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" fill="%239ca3af" font-size="12" text-anchor="middle" dominant-baseline="middle">Photo</text></svg>'
                            }}
                          />
                        </div>

                        {/* Action Toolbar */}
                        <div className="p-2 bg-white flex items-center justify-between border-t border-gray-100 text-xs">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMovePhoto(index, -1)}
                              title="Move left (earlier in order)"
                              className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <ArrowLeftIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={index === photos.length - 1}
                              onClick={() => handleMovePhoto(index, 1)}
                              title="Move right (later in order)"
                              className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <ArrowRightIcon className="h-4 w-4" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setPhotoToDelete(photo)}
                            title="Delete photo"
                            className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Court Layout Section (separate from photo gallery) ── */}
              <div className="pt-4 border-t border-gray-100">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                        <MapIcon className="h-4 w-4 text-primary-600" />
                        Court Layout
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Upload a simple floor plan showing court numbers, entrance and facilities.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        ref={layoutFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleLayoutUpload}
                        disabled={uploadingLayout}
                        className="hidden"
                        id="venue-layout-input"
                      />
                      <label
                        htmlFor="venue-layout-input"
                        className={`btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer ${
                          uploadingLayout ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        {uploadingLayout ? (
                          <>
                            <Spinner size="sm" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpTrayIcon className="h-3.5 w-3.5" />
                            <span>{layoutImage ? 'Replace layout' : 'Upload layout'}</span>
                          </>
                        )}
                      </label>

                      {layoutImage && (
                        <button
                          type="button"
                          onClick={handleDeleteLayout}
                          disabled={uploadingLayout}
                          className="btn-danger text-xs px-2.5 py-1.5 inline-flex items-center gap-1"
                          title="Remove court layout"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <ErrorMessage message={layoutError} />

                  {layoutImage ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white p-2 flex items-center justify-center">
                      <img
                        src={getImageUrl(layoutImage)}
                        alt="Court layout floor plan"
                        className="max-h-56 w-auto object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="py-6 px-4 border border-dashed border-gray-200 rounded-lg text-center bg-white text-xs text-gray-400 font-medium">
                      No layout uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* Close Button in Photos Tab */}
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-primary px-5 text-sm"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete photo confirmation dialog */}
      <ConfirmDialog
        isOpen={Boolean(photoToDelete)}
        title="Remove Venue Photo"
        message="Are you sure you want to remove this photo? If it was uploaded from your computer, the file will be deleted permanently."
        confirmText="Remove Photo"
        confirmVariant="danger"
        onConfirm={handleConfirmDeletePhoto}
        onCancel={() => setPhotoToDelete(null)}
      />
    </>
  )
}
