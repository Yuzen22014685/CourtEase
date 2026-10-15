import { useMemo } from 'react'
import { formatCurrency, getImageUrl } from '../../utils/format'
import {
  ShoppingBagIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

export default function CheckoutAddOnsStep({
  venue,
  shopItems = [],
  selectedAddOns = {},
  courtPriceTotal = 0,
  onQuantityChange,
  onNoteChange,
  onContinue,
  onSkip,
}) {
  const addOnsTotal = useMemo(() => {
    return shopItems.reduce((sum, item) => {
      const qty = selectedAddOns[item._id]?.quantity || 0
      return sum + (item.price || 0) * qty
    }, 0)
  }, [shopItems, selectedAddOns])

  const selectedCount = useMemo(() => {
    return Object.values(selectedAddOns).reduce((sum, val) => sum + (val?.quantity || 0), 0)
  }, [selectedAddOns])

  const total = courtPriceTotal + addOnsTotal

  // Check if any selected service requires a note that is currently empty
  const hasMissingRequiredNotes = useMemo(() => {
    return shopItems.some((item) => {
      const qty = selectedAddOns[item._id]?.quantity || 0
      if (item.category === 'service' && qty > 0 && item.notePrompt?.trim()) {
        const note = selectedAddOns[item._id]?.note || ''
        return !note.trim()
      }
      return false
    })
  }, [shopItems, selectedAddOns])

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-gray-900">
          Add-ons from {venue?.name}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Items are collected at the venue and paid together with your court booking.
        </p>
      </div>

      {/* Cards list */}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {shopItems.map((item) => {
          const currentQty = selectedAddOns[item._id]?.quantity || 0
          const currentNote = selectedAddOns[item._id]?.note || ''
          const isService = item.category === 'service'
          const noteRequired = isService && currentQty > 0 && Boolean(item.notePrompt?.trim())
          const isMissingNote = noteRequired && !currentNote.trim()

          return (
            <div
              key={item._id}
              className={`p-4 rounded-xl border transition-all ${
                currentQty > 0
                  ? 'border-primary-300 bg-primary-50/20 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left: Thumbnail & Details */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {item.photo ? (
                    <img
                      src={getImageUrl(item.photo)}
                      alt={item.name}
                      className="w-11 h-11 rounded-lg object-cover shrink-0 mt-0.5 border border-gray-100 shadow-sm"
                    />
                  ) : (
                    <div
                      className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isService ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {isService ? (
                        <WrenchScrewdriverIcon className="h-5 w-5" />
                      ) : (
                        <ShoppingBagIcon className="h-5 w-5" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-gray-900 leading-snug">
                        {item.name}
                      </h4>
                      {isService && item.readyInfo && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded px-1.5 py-0.5">
                          <ClockIcon className="h-3 w-3" />
                          {item.readyInfo}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-bold text-gray-800 mt-0.5">
                      {formatCurrency(item.price)}
                    </p>

                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Quantity Stepper */}
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shrink-0 shadow-sm">
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item._id, currentQty - 1)}
                    disabled={currentQty <= 0}
                    className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label={`Decrease quantity of ${item.name}`}
                  >
                    −
                  </button>
                  <span className="px-2.5 py-1 text-xs font-bold text-gray-900 min-w-[1.75rem] text-center select-none bg-white">
                    {currentQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item._id, currentQty + 1)}
                    disabled={currentQty >= 10}
                    className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label={`Increase quantity of ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Service Required Note Input */}
              {isService && currentQty > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor={`addon-note-${item._id}`}
                      className="font-medium text-gray-700"
                    >
                      {item.notePrompt || 'Details / preferences'}
                      {noteRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {isMissingNote && (
                      <span className="text-red-600 flex items-center gap-1 text-[11px] font-medium">
                        <ExclamationCircleIcon className="h-3.5 w-3.5" />
                        Please answer: {item.notePrompt}
                      </span>
                    )}
                  </div>
                  <input
                    id={`addon-note-${item._id}`}
                    type="text"
                    maxLength={100}
                    value={currentNote}
                    onChange={(e) => onNoteChange(item._id, e.target.value)}
                    placeholder={item.notePrompt ? `e.g. ${item.notePrompt}` : 'Enter instructions'}
                    className={`input text-xs py-1.5 px-3 ${
                      isMissingNote ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                    }`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-3.5 pb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-gray-600 text-center sm:text-left leading-relaxed">
          Courts <span className="whitespace-nowrap font-semibold text-gray-900">{formatCurrency(courtPriceTotal)}</span>
          <span className="mx-1.5 text-gray-400">+</span>
          Add-ons <span className="whitespace-nowrap font-semibold text-gray-900">{formatCurrency(addOnsTotal)}</span>
          <span className="mx-1.5 text-gray-400">=</span>
          <span className="whitespace-nowrap text-sm font-bold text-green-600 ml-0.5">{formatCurrency(total)}</span>
        </div>

        <div className="w-full sm:w-auto">
          <button
            type="button"
            onClick={selectedCount > 0 ? onContinue : onSkip}
            disabled={selectedCount > 0 && hasMissingRequiredNotes}
            className={
              selectedCount > 0
                ? 'btn-primary w-full sm:w-auto text-xs px-4 py-2'
                : 'btn-secondary w-full sm:w-auto text-xs px-3.5 py-2'
            }
          >
            {selectedCount > 0 ? `Continue · ${formatCurrency(addOnsTotal)}` : 'Skip add-ons'}
          </button>
        </div>
      </div>
    </div>
  )
}
