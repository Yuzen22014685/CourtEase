import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { getVenueById, getVenueAvailability, getVenueReviews } from '../../api/venues'
import { createBooking } from '../../api/bookings'
import Layout from '../../components/layout/Layout'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import UploadReceiptPanel from '../../components/bookings/UploadReceiptPanel'
import PayVenueCard from '../../components/bookings/PayVenueCard'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatCurrency, formatDate, formatTime, todayString, getImageUrl } from '../../utils/format'
import {
  MapPinIcon,
  ClockIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  ShoppingCartIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowUpTrayIcon,
  ShieldCheckIcon,
  PhoneIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

/** Unique key for a cart slot */
const slotKey = (courtId, start) => `${courtId}::${start}`

export default function VenueDetailPage() {
  const { id } = useParams()

  // ── Venue info ────────────────────────────────────────────────
  const { data: venueData, loading: venueLoading, error: venueError } =
    useApi(() => getVenueById(id), [id])
  const venue = venueData?.data

  // ── Reviews ───────────────────────────────────────────────────
  const [reviewPage, setReviewPage] = useState(1)
  const [allReviews, setAllReviews] = useState([])
  const [reviewsMeta, setReviewsMeta] = useState({ total: 0, hasMore: false })
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState('')

  // Load initial reviews when venue is known
  useEffect(() => {
    if (!id) return
    setReviewsLoading(true)
    setReviewsError('')
    getVenueReviews(id, 1)
      .then((res) => {
        const d = res.data
        setAllReviews(d.data)
        setReviewsMeta({ total: d.total, hasMore: d.hasMore })
        setReviewPage(1)
      })
      .catch(() => setReviewsError('Could not load reviews.'))
      .finally(() => setReviewsLoading(false))
  }, [id])

  const loadMoreReviews = () => {
    const nextPage = reviewPage + 1
    setReviewsLoading(true)
    getVenueReviews(id, nextPage)
      .then((res) => {
        const d = res.data
        setAllReviews((prev) => [...prev, ...d.data])
        setReviewsMeta({ total: d.total, hasMore: d.hasMore })
        setReviewPage(nextPage)
      })
      .catch(() => setReviewsError('Could not load more reviews.'))
      .finally(() => setReviewsLoading(false))
  }

  // ── Date picker ───────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(todayString())

  // ── Availability matrix ───────────────────────────────────────
  const fetchAvailability = useCallback(
    () => getVenueAvailability(id, selectedDate),
    [id, selectedDate]
  )
  const { data: availData, loading: availLoading, error: availError, refetch: refetchAvail } =
    useApi(fetchAvailability, [selectedDate])

  // ── Cart: array of { courtId, courtNumber, start, end } ───────
  const [cart, setCart] = useState([])

  // ── Payment methods derived from venue.paymentOptions ─────────
  const availablePaymentMethods = useMemo(() => {
    const methods = []
    if (venue?.paymentOptions?.duitNowQr) {
      methods.push({ value: 'duitnow_qr', label: 'DuitNow QR' })
    }
    if (venue?.paymentOptions?.bankTransfer) {
      methods.push({ value: 'bank_transfer', label: 'Bank transfer' })
    }
    return methods
  }, [venue?.paymentOptions])

  // ── Checkout modal state ──────────────────────────────────────
  const [checkoutOpen, setCheckoutOpen]     = useState(false)
  const [paymentMethod, setPaymentMethod]   = useState('duitnow_qr')
  const [bookingLoading, setBookingLoading] = useState(false)
  // bookingResults: { successes: [...], failures: [...] } | null
  const [bookingResults, setBookingResults] = useState(null)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [uploadSkipped, setUploadSkipped]   = useState(false)
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false)

  // Default to first available payment method when venue options load
  useEffect(() => {
    if (availablePaymentMethods.length > 0) {
      if (!availablePaymentMethods.some((m) => m.value === paymentMethod)) {
        setPaymentMethod(availablePaymentMethods[0].value)
      }
    }
  }, [availablePaymentMethods, paymentMethod])

  // Mobile cart sheet
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  // ── Slot toggle ───────────────────────────────────────────────
  const handleSlotClick = (courtId, courtNumber, slot) => {
    if (!slot.available) return
    const key = slotKey(courtId, slot.start)
    setCart((prev) => {
      const exists = prev.find((s) => slotKey(s.courtId, s.start) === key)
      if (exists) {
        return prev.filter((s) => slotKey(s.courtId, s.start) !== key)
      }
      return [...prev, { courtId, courtNumber, start: slot.start, end: slot.end }]
    })
  }

  const removeFromCart = (key) =>
    setCart((prev) => prev.filter((s) => slotKey(s.courtId, s.start) !== key))

  const clearCart = () => setCart([])

  // ── Checkout submit ───────────────────────────────────────────
  const handleCheckout = async () => {
    if (cart.length === 0 || !venue) return
    setBookingLoading(true)

    // Snapshot cart into a plain immutable array BEFORE any await.
    const cartSnapshot = cart.map((s) => ({
      courtId:     s.courtId,
      courtNumber: s.courtNumber,
      start:       s.start,
      end:         s.end,
    }))

    const results = { successes: [], failures: [] }
    let sharedPaymentRef = undefined

    // Sequential (not parallel) to avoid race conditions on the same court
    for (const slot of cartSnapshot) {
      try {
        const payload = {
          venueId:     id,
          courtId:     slot.courtId,
          date:        selectedDate,
          startTime:   slot.start,
          endTime:     slot.end,
          paymentMethod,
        }
        if (sharedPaymentRef) {
          payload.paymentRef = sharedPaymentRef
        }

        const res = await createBooking(payload)
        const b = res.data.data
        if (!sharedPaymentRef && b.paymentRef) {
          sharedPaymentRef = b.paymentRef
        }

        results.successes.push({
          bookingId:   b._id,
          courtId:     slot.courtId,
          courtNumber: slot.courtNumber,
          start:       slot.start,
          end:         slot.end,
          receiptId:   b.receiptId,
          paymentRef:  b.paymentRef,
          amount:      b.amount,
          paymentMethod: b.paymentMethod,
        })
      } catch (err) {
        const message = err.response?.data?.message || 'Booking failed. Please try again.'
        results.failures.push({
          courtId:     slot.courtId,
          courtNumber: slot.courtNumber,
          start:       slot.start,
          end:         slot.end,
          error:       message,
        })
      }
    }

    setBookingLoading(false)
    setUploadComplete(false)
    setUploadSkipped(false)
    setSkipConfirmOpen(false)
    setBookingResults(results)
    clearCart()
    refetchAvail()
  }

  const handleCloseCheckout = () => {
    setCheckoutOpen(false)
    if (availablePaymentMethods.length > 0) {
      setPaymentMethod(availablePaymentMethods[0].value)
    }
  }

  const handleCloseResults = () => {
    setBookingResults(null)
  }

  // Derived
  const cartSet    = new Set(cart.map((s) => slotKey(s.courtId, s.start)))
  const totalPrice = cart.length * (venue?.pricePerHour ?? 0)
  const matrix     = availData?.matrix ?? []

  const isMobileBarVisible = cart.length > 0 && !mobileCartOpen && !checkoutOpen && !bookingResults

  // ── Loading / error states ────────────────────────────────────
  if (venueLoading) return (
    <Layout>
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    </Layout>
  )

  if (venueError || !venue) return (
    <Layout>
      <div className="page-container">
        <ErrorMessage message={venueError || 'Venue not found'} />
        <Link to="/venues" className="btn-secondary mt-4 inline-flex">
          <ArrowLeftIcon className="h-4 w-4" /> Back to venues
        </Link>
      </div>
    </Layout>
  )

  return (
    <Layout>
      {/* ── Main layout: matrix + desktop cart sidebar ── */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 ${isMobileBarVisible ? 'pb-24 lg:pb-6' : 'pb-6'}`}>
        {/* Back link */}
        <Link to="/venues" className="inline-flex items-center gap-1.5 text-sm text-gray-500
                                     hover:text-primary-600 transition-colors mb-6">
          <ArrowLeftIcon className="h-4 w-4" /> All venues
        </Link>

        <div className="flex gap-6 items-start">
          {/* ── Left column ── */}
          <div className="flex-1 min-w-0">
            {/* Photo Gallery or Neutral Placeholder */}
            {venue.photos?.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4 mb-4 snap-x hide-scrollbar">
                {venue.photos.map((photo, i) => (
                  <div key={i} className="relative shrink-0 snap-center">
                    <img 
                      src={getImageUrl(photo)} 
                      alt={`${venue.name} - view ${i + 1}`} 
                      className="h-56 sm:h-72 w-[85%] sm:w-auto aspect-[4/3] object-cover rounded-xl shadow-sm border border-gray-100" 
                      onError={(e) => {
                        e.target.style.display = 'none'
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                    <div className="hidden h-56 sm:h-72 w-72 rounded-xl bg-gray-100 flex-col items-center justify-center text-gray-400">
                      <BuildingOffice2Icon className="h-10 w-10 text-gray-300" />
                      <span className="text-xs text-gray-400 mt-1">Image unavailable</span>
                    </div>
                    {i === 0 && (
                      <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-44 sm:h-56 w-full rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 border-dashed flex flex-col items-center justify-center text-gray-400 mb-6 shadow-inner">
                <BuildingOffice2Icon className="h-12 w-12 text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-600">{venue.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">No venue photos uploaded yet</p>
              </div>
            )}

            {/* Venue header */}
            <div className="card p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="badge bg-primary-100 text-primary-700">{venue.area}</span>
                    {venue.rating != null ? (
                      <span className="flex items-center gap-1 text-sm font-bold text-gray-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <StarIcon className="h-4 w-4 text-amber-500" />
                        {venue.rating.toFixed(1)}
                        <span className="text-xs font-normal text-gray-500 ml-0.5">({venue.reviewCount})</span>
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-500">
                        New
                      </span>
                    )}
                  </div>
                  <h1 className="page-title text-2xl mb-3">{venue.name}</h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <MapPinIcon className="h-4 w-4 text-gray-400 shrink-0" />
                      {venue.address}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ClockIcon className="h-4 w-4 text-gray-400 shrink-0" />
                      {venue.operatingHours.open} – {venue.operatingHours.close}
                    </span>
                    {venue.phone && (
                      <a
                        href={`tel:${venue.phone}`}
                        className="flex items-center gap-1.5 hover:text-primary-600 transition-colors"
                      >
                        <PhoneIcon className="h-4 w-4 text-gray-400 shrink-0" />
                        {venue.phone}
                      </a>
                    )}
                  </div>

                  {/* Description */}
                  {venue.description && (
                    <p className="text-sm text-gray-600 mt-4 leading-relaxed whitespace-pre-line border-t border-gray-100 pt-3">
                      {venue.description}
                    </p>
                  )}

                  {/* Facilities */}
                  {venue.facilities?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {venue.facilities.map((fac, i) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600">
                          {fac}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-left sm:text-right shrink-0 mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-gray-100">
                  <p className="text-3xl font-bold text-primary-600">RM {venue.pricePerHour}</p>
                  <p className="text-xs text-gray-400 mt-1">per hour · {venue.numberOfCourts} courts</p>
                </div>
              </div>
            </div>

            {/* Court layout card */}
            {venue.layoutImage && (
              <div className="card p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-900">Court layout</h2>
                  <a
                    href={getImageUrl(venue.layoutImage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
                  >
                    Open full size ↗
                  </a>
                </div>
                <a
                  href={getImageUrl(venue.layoutImage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:opacity-95 transition-opacity cursor-zoom-in"
                  title="Click to open full size in a new tab"
                >
                  <img
                    src={getImageUrl(venue.layoutImage)}
                    alt={`${venue.name} Court Layout`}
                    className="w-full max-h-96 object-contain mx-auto"
                  />
                </a>
              </div>
            )}

            {/* Date picker */}
            <div className="card p-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <CalendarDaysIcon className="h-5 w-5 text-primary-600" />
                  <span className="font-medium text-gray-800 text-sm">Select date</span>
                </div>
                <input
                  id="booking-date"
                  type="date"
                  value={selectedDate}
                  min={todayString()}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    clearCart()
                  }}
                  className="input max-w-xs"
                />
                {selectedDate && (
                  <span className="text-sm text-gray-500">{formatDate(selectedDate)}</span>
                )}
              </div>
            </div>

            {/* Slot matrix */}
            <div className="card mb-4">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-semibold text-gray-900 text-sm">Court Availability</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-primary-100 border border-primary-200 inline-block" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-200 border border-amber-400 inline-block" />
                    In cart
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" />
                    Booked / Past
                  </span>
                </div>
              </div>

              {availLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <Spinner size="lg" className="mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Loading availability…</p>
                  </div>
                </div>
              ) : availError ? (
                <div className="p-5"><ErrorMessage message={availError} /></div>
              ) : matrix.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">No courts available for this date.</div>
              ) : (
                <SlotMatrix
                  matrix={matrix}
                  cartSet={cartSet}
                  selectedDate={selectedDate}
                  onSlotClick={handleSlotClick}
                />
              )}
            </div>

            {!availLoading && matrix.length > 0 && (
              <p className="text-xs text-gray-400 text-center mb-4">
                Click available slots to add them to your cart. Click again to deselect.
              </p>
            )}

            {/* Reviews Section */}
            <div className="card p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Reviews</h2>
                {reviewsMeta.total > 0 && venue?.rating != null && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map((s) => (
                        s <= Math.round(venue.rating)
                          ? <StarIcon key={s} className="h-4 w-4 text-amber-400" />
                          : <StarOutlineIcon key={s} className="h-4 w-4 text-amber-300" />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-gray-800">{venue.rating.toFixed(1)}</span>
                    <span className="text-xs text-gray-400">({reviewsMeta.total} review{reviewsMeta.total !== 1 ? 's' : ''})</span>
                  </div>
                )}
              </div>

              {reviewsError && <ErrorMessage message={reviewsError} className="mb-4" />}

              {allReviews.length > 0 ? (
                <div className="space-y-4">
                  {allReviews.map((r) => (
                    <div key={r._id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="font-medium text-sm text-gray-900">{r.reviewerName}</span>
                          {r.verifiedBooking && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                              <ShieldCheckIcon className="h-3 w-3" />
                              Verified booking
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 ml-2">
                          {r.date ? formatDate(new Date(r.date).toISOString().split('T')[0]) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 mb-2">
                        {[1,2,3,4,5].map((s) => (
                          s <= r.rating
                            ? <StarIcon key={s} className="h-3.5 w-3.5 text-amber-400" />
                            : <StarOutlineIcon key={s} className="h-3.5 w-3.5 text-amber-300" />
                        ))}
                        <span className="ml-1 text-xs font-semibold text-gray-700">{r.rating}.0</span>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
                      )}
                    </div>
                  ))}

                  {reviewsMeta.hasMore && (
                    <div className="pt-2 text-center">
                      <button
                        onClick={loadMoreReviews}
                        disabled={reviewsLoading}
                        className="btn-secondary btn-sm"
                      >
                        {reviewsLoading ? <><Spinner size="sm" /> Loading…</> : 'Load more'}
                      </button>
                    </div>
                  )}
                </div>
              ) : reviewsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <Spinner size="sm" /> Loading reviews…
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No reviews yet — be the first to play here and share your experience.
                </p>
              )}
            </div>
          </div>

          {/* ── Desktop cart sidebar ── */}
          <div className="hidden lg:block w-80 shrink-0 self-stretch">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
              <CartPanel
                cart={cart}
                venue={venue}
                date={selectedDate}
                totalPrice={totalPrice}
                onRemove={removeFromCart}
                onClear={clearCart}
                onCheckout={() => setCheckoutOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile cart bottom bar ── */}
      {isMobileBarVisible && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-elevated px-4 py-3">
          <button
            id="mobile-cart-btn"
            onClick={() => setMobileCartOpen(true)}
            className="btn-primary w-full"
          >
            <ShoppingCartIcon className="h-4 w-4" />
            View Cart ({cart.length} slot{cart.length !== 1 ? 's' : ''}) · {formatCurrency(totalPrice)}
          </button>
        </div>
      )}

      {/* ── Mobile cart sheet ── */}
      <Modal
        isOpen={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        title={`Cart (${cart.length} slot${cart.length !== 1 ? 's' : ''})`}
        size="lg"
      >
        <CartPanel
          cart={cart}
          venue={venue}
          date={selectedDate}
          totalPrice={totalPrice}
          onRemove={(key) => { removeFromCart(key) }}
          onClear={() => { clearCart(); setMobileCartOpen(false) }}
          onCheckout={() => { setMobileCartOpen(false); setCheckoutOpen(true) }}
        />
      </Modal>

      {/* ── Checkout modal: payment + confirm ── */}
      <Modal
        isOpen={checkoutOpen && !bookingResults}
        onClose={handleCloseCheckout}
        title="Confirm Booking"
        size="lg"
      >
        <CheckoutPanel
          cart={cart}
          venue={venue}
          date={selectedDate}
          totalPrice={totalPrice}
          paymentMethod={paymentMethod}
          availablePaymentMethods={availablePaymentMethods}
          onPaymentChange={setPaymentMethod}
          onConfirm={handleCheckout}
          onCancel={handleCloseCheckout}
          loading={bookingLoading}
        />
      </Modal>

      {/* ── Results modal (success / partial failure) ── */}
      <Modal
        isOpen={!!bookingResults}
        disableBackdropClick={!uploadComplete && !uploadSkipped && bookingResults?.successes?.length > 0}
        onClose={
          (!uploadComplete && !uploadSkipped && bookingResults?.successes?.length > 0)
            ? () => setSkipConfirmOpen(true)
            : handleCloseResults
        }
        title={
          !uploadComplete && !uploadSkipped && bookingResults?.successes?.length > 0
            ? 'Step 2 — Pay the venue, then upload your receipt'
            : bookingResults?.failures?.length === 0
            ? '🎉 Bookings submitted!'
            : bookingResults?.successes?.length === 0
            ? 'All bookings failed'
            : 'Booking summary'
        }
        size="lg"
      >
        {bookingResults && (
          (!uploadComplete && !uploadSkipped && bookingResults.successes.length > 0) ? (
            <div className="space-y-6">
              <PayVenueCard
                bookingId={bookingResults.successes[0].bookingId}
                chosenMethod={paymentMethod}
              />
              <UploadReceiptPanel 
                bookingIds={bookingResults.successes.map((b) => b.bookingId)} 
                onSuccess={() => setUploadComplete(true)} 
              />
            </div>
          ) : (
            <ResultsPanel
              results={bookingResults}
              venue={venue}
              date={selectedDate}
              uploadSkipped={uploadSkipped}
              onClose={handleCloseResults}
            />
          )
        )}
      </Modal>

      {/* ── Skip Upload Confirmation ── */}
      <ConfirmDialog
        isOpen={skipConfirmOpen}
        title="Skip Receipt Upload?"
        message="You haven't uploaded your payment receipt yet. Your booking will stay Pending until you upload it (you can do this anytime from My Bookings). Skip for now?"
        confirmText="Skip Anyway"
        cancelText="Go Back"
        onConfirm={() => {
          setSkipConfirmOpen(false)
          setUploadSkipped(true)
        }}
        onCancel={() => setSkipConfirmOpen(false)}
      />
    </Layout>
  )
}

/* ── Slot Matrix ──────────────────────────────────────────────────────────── */
function SlotMatrix({ matrix, cartSet, selectedDate, onSlotClick }) {
  const allSlots = matrix[0]?.slots ?? []

  // Compute once per render: is the selected date today (Malaysia UTC+8)?
  // We compare ISO date strings to avoid timezone-offset edge cases.
  const todayMY = new Date(
    new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).split(',')[0]
  ).toISOString().slice(0, 10)
  const isToday = selectedDate === todayMY

  return (
    <div className="slot-matrix-scroll p-1">
      <table className="min-w-max w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-medium text-gray-400
                            border-b border-gray-100 w-20">
              Court
            </th>
            {allSlots.map((slot) => (
              <th key={slot.start}
                  className="px-2 py-3 font-medium text-gray-400 border-b border-gray-100
                             text-center whitespace-nowrap min-w-[72px]">
                {slot.start}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((court) => (
            <tr key={court.courtId} className="hover:bg-gray-50/30">
              <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-semibold text-gray-700
                              border-b border-gray-50 whitespace-nowrap">
                Court {court.courtNumber}
              </td>
              {court.slots.map((slot) => {
                const key    = `${court.courtId}::${slot.start}`
                const inCart = cartSet.has(key)

                // Past-slot check — only applies when the selected date is today.
                // Uses the same Malaysia UTC+8 Date construction as createBooking
                // and cancelBooking in the backend.
                const isPast = isToday &&
                  new Date(`${selectedDate}T${slot.start}:00+08:00`) <= new Date()

                // A slot is unavailable if booked by another player OR already past
                const unavailable = !slot.available || isPast

                const slotLabel = inCart
                  ? 'in cart (click to remove)'
                  : isPast
                  ? 'past'
                  : slot.available
                  ? 'available'
                  : 'booked'

                return (
                  <td key={slot.start} className="px-1 py-2 border-b border-gray-50 text-center">
                    <button
                      onClick={() => onSlotClick(court.courtId, court.courtNumber, slot)}
                      disabled={unavailable}
                      className={clsx(
                        'w-full rounded-lg py-1.5 px-1 font-medium transition-all duration-150 text-xs',
                        inCart
                          ? 'bg-amber-100 text-amber-800 border border-amber-400 shadow-sm scale-105 ring-1 ring-amber-300'
                          : unavailable
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                          : 'bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 hover:border-primary-400 cursor-pointer'
                      )}
                      aria-label={`Court ${court.courtNumber}, ${slot.start}–${slot.end}, ${slotLabel}`}
                    >
                      {inCart ? '✓' : unavailable ? '–' : slot.start}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Cart Panel ───────────────────────────────────────────────────────────── */
function CartPanel({ cart, venue, date, totalPrice, onRemove, onClear, onCheckout }) {
  const hasPaymentOptions = Boolean(venue?.paymentOptions?.duitNowQr || venue?.paymentOptions?.bankTransfer)

  if (cart.length === 0) {
    return (
      <div className="card p-6 text-center">
        <ShoppingCartIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-500">Your cart is empty</p>
        <p className="text-xs text-gray-400 mt-1">Select available slots from the schedule</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ShoppingCartIcon className="h-5 w-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900 text-sm">
            Selected Slots ({cart.length})
          </h3>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Slot list */}
      <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
        {cart.map((slot) => {
          const key = `${slot.courtId}::${slot.start}`
          return (
            <div key={key} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Court {slot.courtNumber}</p>
                <p className="text-xs text-gray-500">
                  {formatTime(slot.start)} – {formatTime(slot.end)}
                </p>
              </div>
              <span className="text-sm font-semibold text-primary-600 shrink-0">
                {formatCurrency(venue?.pricePerHour ?? 0)}
              </span>
              <button
                onClick={() => onRemove(key)}
                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                aria-label="Remove slot"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Date row */}
      <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
        📅 {formatDate(date)}
      </div>

      {/* Total + CTA */}
      <div className="px-5 py-4 border-t border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 font-medium">Total</span>
          <span className="text-xl font-bold text-primary-600">{formatCurrency(totalPrice)}</span>
        </div>
        <button
          id="checkout-btn"
          onClick={onCheckout}
          disabled={cart.length === 0 || !hasPaymentOptions}
          className="btn-primary w-full"
        >
          Confirm Booking →
        </button>
        {!hasPaymentOptions && (
          <p className="text-xs text-red-500 text-center font-medium">
            This venue hasn't set up payment details yet.
          </p>
        )}
        <p className="text-xs text-gray-400 text-center">
          You pay the venue directly. CourtEase never handles your money.
        </p>
      </div>
    </div>
  )
}

/* ── Checkout Panel ───────────────────────────────────────────────────────── */
function CheckoutPanel({
  cart,
  venue,
  date,
  totalPrice,
  paymentMethod,
  availablePaymentMethods = [],
  onPaymentChange,
  onConfirm,
  onCancel,
  loading,
}) {
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTermsWarning, setShowTermsWarning] = useState(false)

  const hasPaymentOptions = availablePaymentMethods.length > 0

  const handleConfirmClick = () => {
    if (!termsAccepted) {
      setShowTermsWarning(true)
      return
    }
    setShowTermsWarning(false)
    onConfirm()
  }

  return (
    <div className="space-y-6">
      {/* Booking summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-500 text-xs">
          <span>{venue?.name}</span>
          <span>{cart.length} slot{cart.length !== 1 ? 's' : ''} · {formatDate(date)}</span>
        </div>
        {cart.map((slot) => (
          <div key={slotKey(slot.courtId, slot.start)} className="flex justify-between text-xs">
            <span className="text-gray-700">
              Court {slot.courtNumber} · {formatTime(slot.start)}–{formatTime(slot.end)}
            </span>
            <span className="font-medium text-gray-800 shrink-0 ml-2">
              {formatCurrency(venue?.pricePerHour ?? 0)}
            </span>
          </div>
        ))}
        <hr className="border-gray-200 my-2" />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-800">Total</span>
          <span className="text-lg font-bold text-primary-600">{formatCurrency(totalPrice)}</span>
        </div>
      </div>

      {/* Payment method */}
      <div className="space-y-2">
        <label className="label">Payment method</label>
        {!hasPaymentOptions ? (
          <p className="text-sm text-gray-500 italic">This venue hasn't set up payment details yet.</p>
        ) : (
          <div className="space-y-2">
            {availablePaymentMethods.map((m) => (
              <label
                key={m.value}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                  paymentMethod === m.value
                    ? 'border-primary-500 bg-primary-50/40 text-gray-900 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.value}
                  checked={paymentMethod === m.value}
                  onChange={(e) => onPaymentChange(e.target.value)}
                  disabled={loading}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="text-sm">{m.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Terms & Conditions ─────────────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Terms &amp; Conditions
        </p>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400 shrink-0">•</span>
            <span>Payment is made directly to the venue by DuitNow QR or bank transfer. CourtEase does not process or hold payments.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400 shrink-0">•</span>
            <span>All bookings are non-refundable.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400 shrink-0">•</span>
            <span>You can reschedule a booking once, up to 24 hours before the session starts (same venue, same duration).</span>
          </li>
          {/* Remove if ALLOW_CANCEL_WITHOUT_REFUND is set to false in config/bookingPolicy.js */}
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400 shrink-0">•</span>
            <span>You can cancel a booking any time before the session starts, but the booking fee will not be refunded.</span>
          </li>
        </ul>

        {/* Checkbox */}
        <label
          htmlFor="terms-checkbox"
          className="flex items-start gap-2.5 cursor-pointer group pt-1"
        >
          <input
            id="terms-checkbox"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => {
              setTermsAccepted(e.target.checked)
              if (e.target.checked) setShowTermsWarning(false)
            }}
            disabled={loading}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600
                       focus:ring-primary-500 cursor-pointer accent-primary-600 shrink-0"
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-snug">
            I have read and agree to the Terms &amp; Conditions
          </span>
        </label>

        {/* Inline warning — shown only when player tries to pay without ticking */}
        {showTermsWarning && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
            Please accept the Terms &amp; Conditions before proceeding.
          </p>
        )}
      </div>
      {/* ─────────────────────────────────────────────────────────────────────── */}

      {loading && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-xl">
          <Spinner size="sm" />
          <p className="text-sm text-primary-700">
            Processing bookings sequentially… please wait.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
          Back
        </button>
        <button
          id="confirm-booking-btn"
          onClick={handleConfirmClick}
          disabled={loading || cart.length === 0 || !hasPaymentOptions}
          className="btn-primary flex-1"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" /> Processing…
            </span>
          ) : (
            'Book & get payment details'
          )}
        </button>
      </div>
      {!hasPaymentOptions && (
        <p className="text-xs text-red-500 text-center -mt-2 font-medium">
          This venue hasn't set up payment details yet.
        </p>
      )}
      <p className="text-xs text-gray-400 text-center">
        You pay the venue directly. CourtEase never handles your money.
      </p>
    </div>
  )
}

/* ── Results Panel ────────────────────────────────────────────────────────── */
// Each item in results.successes / results.failures is a flat POJO with all
// slot fields copied as primitives — no live object references, no API response
// objects. This panel only reads from data it owns outright.
function ResultsPanel({ results, venue, date, uploadSkipped, onClose }) {
  const { successes, failures } = results
  const allOk     = failures.length === 0
  const allFailed = successes.length === 0
  const totalPaid = successes.reduce((sum, s) => sum + (s.amount ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* Overall status */}
      <div className={clsx(
        'flex flex-col items-center gap-3 py-4',
        allOk ? 'text-primary-700' : allFailed ? 'text-red-600' : 'text-amber-600'
      )}>
        <div className={clsx(
          'w-14 h-14 rounded-full flex items-center justify-center',
          allOk ? 'bg-primary-100' : allFailed ? 'bg-red-100' : 'bg-amber-100'
        )}>
          {allOk
            ? <CheckCircleIcon className="h-8 w-8 text-primary-600" />
            : allFailed
            ? <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            : <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
          }
        </div>
        <div className="text-center">
          <p className="font-bold text-gray-900 text-base">
            {allOk
              ? uploadSkipped 
                ? 'Bookings submitted! Awaiting payment receipt.' 
                : 'Receipt submitted! Your booking is awaiting admin approval.'
              : allFailed
              ? 'All bookings failed'
              : `${successes.length} succeeded · ${failures.length} failed`}
          </p>
          <p className="text-xs text-gray-500 mt-1">{venue?.name} · {formatDate(date)}</p>
        </div>
      </div>

      {/* Successful bookings — each item has courtNumber, start, end, receiptId, amount */}
      {successes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5 text-primary-500" />
            Confirmed ({successes.length})
          </p>
          <div className="bg-primary-50 rounded-xl divide-y divide-primary-100 overflow-hidden">
            {successes.map((item) => (
              <div key={item.receiptId} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      Court {item.courtNumber} · {formatTime(item.start)}–{formatTime(item.end)}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{item.receiptId}</p>
                  </div>
                  <span className="font-semibold text-primary-700 shrink-0">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
            {successes.length > 1 && (
              <div className="px-4 py-3 flex justify-between text-sm font-bold text-primary-800">
                <span>Total paid</span>
                <span>{formatCurrency(totalPaid)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Failed bookings — each item has courtNumber, start, end, error */}
      {failures.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" />
            Failed ({failures.length})
          </p>
          <div className="bg-red-50 rounded-xl divide-y divide-red-100 overflow-hidden">
            {failures.map((item) => (
              <div key={`${item.courtId}::${item.start}`} className="px-4 py-3 text-sm">
                <p className="font-medium text-gray-900">
                  Court {item.courtNumber} · {formatTime(item.start)}–{formatTime(item.end)}
                </p>
                <p className="text-xs text-red-600 mt-1">{item.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">
          Book more slots
        </button>
        <Link
          to="/my-bookings"
          className="btn-primary flex-1 text-center justify-center"
          onClick={onClose}
        >
          My Bookings
        </Link>
      </div>
    </div>
  )
}
