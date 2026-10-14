import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { formatDays } from '../../utils/format'

const DAY_OPTIONS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
]

const toMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

export default function PricingRulesEditor({
  rules = [],
  onChange,
  operatingHours = { open: '08:00', close: '22:00' },
  defaultPrice = '25',
}) {
  const openMin = toMinutes(operatingHours?.open)
  const closeMin = toMinutes(operatingHours?.close)

  const handleAddRule = () => {
    if (rules.length >= 10) return
    const newRule = {
      days: [1, 2, 3, 4, 5],
      start: operatingHours?.open || '08:00',
      end: operatingHours?.close || '22:00',
      pricePerHour: defaultPrice !== '' && defaultPrice != null ? String(defaultPrice) : '25',
    }
    onChange([...rules, newRule])
  }

  const handleRemoveRule = (index) => {
    onChange(rules.filter((_, i) => i !== index))
  }

  const handleUpdateRule = (index, field, value) => {
    const updated = rules.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    onChange(updated)
  }

  const handleToggleDay = (index, dayValue) => {
    const current = rules[index]?.days || []
    const nextDays = current.includes(dayValue)
      ? current.filter((d) => d !== dayValue)
      : [...current, dayValue]
    handleUpdateRule(index, 'days', nextDays)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Set different prices for certain days and times. Any time not covered uses the default price (RM {defaultPrice || 0}/hr).
      </p>

      {/* Rules list */}
      {rules.length > 0 && (
        <div className="space-y-3">
          {rules.map((rule, index) => {
            const startMin = toMinutes(rule.start)
            const endMin = toMinutes(rule.end)

            const noDays = !rule.days || rule.days.length === 0
            const invalidTimes = startMin != null && endMin != null && startMin >= endMin
            const outsideHours =
              openMin != null &&
              closeMin != null &&
              startMin != null &&
              endMin != null &&
              (startMin < openMin || endMin > closeMin)

            return (
              <div
                key={index}
                className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3"
              >
                {/* Header row: Rule index + Remove */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">
                    Rule #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(index)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>

                {/* Day selector chips */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1.5">
                    Days
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_OPTIONS.map((opt) => {
                      const isSelected = rule.days?.includes(opt.value)
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleToggleDay(index, opt.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-primary-600 text-white shadow-sm'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Times & Price row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Start
                    </label>
                    <input
                      type="time"
                      value={rule.start || ''}
                      onChange={(e) => handleUpdateRule(index, 'start', e.target.value)}
                      className="input w-full text-xs text-center py-1.5"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      End
                    </label>
                    <input
                      type="time"
                      value={rule.end || ''}
                      onChange={(e) => handleUpdateRule(index, 'end', e.target.value)}
                      className="input w-full text-xs text-center py-1.5"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Price / hr (RM)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={rule.pricePerHour ?? ''}
                      onChange={(e) => handleUpdateRule(index, 'pricePerHour', e.target.value)}
                      className="input w-full text-xs py-1.5"
                    />
                  </div>
                </div>

                {/* Validation hints */}
                {noDays && (
                  <p className="text-[11px] text-red-500 font-medium">
                    Choose at least one day.
                  </p>
                )}
                {invalidTimes && (
                  <p className="text-[11px] text-red-500 font-medium">
                    Start time must be before end time.
                  </p>
                )}
                {outsideHours && (
                  <p className="text-[11px] text-red-500 font-medium">
                    Times must be within opening hours ({operatingHours?.open}–{operatingHours?.close}).
                  </p>
                )}

                {/* Preview line */}
                <div className="pt-2 border-t border-gray-200/60 text-[11px] text-gray-500 flex items-center justify-between">
                  <span>
                    {rule.days?.length > 0 ? formatDays(rule.days) : 'Choose days'} · {rule.start || '—'}–{rule.end || '—'} · RM {rule.pricePerHour || 0}/hr
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Rule Button */}
      <div>
        <button
          type="button"
          onClick={handleAddRule}
          disabled={rules.length >= 10}
          className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add rule {rules.length > 0 && `(${rules.length}/10)`}
        </button>
      </div>
    </div>
  )
}
