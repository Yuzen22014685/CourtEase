import { formatMonth, shiftMonth, currentMonthMY } from '../../utils/format'

export default function MonthPicker({ value, onChange }) {
  const currentMY = currentMonthMY()
  const isLatest = value >= currentMY

  const handlePrev = () => {
    onChange(shiftMonth(value, -1))
  }

  const handleNext = () => {
    if (!isLatest) {
      onChange(shiftMonth(value, 1))
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
      <button
        type="button"
        onClick={handlePrev}
        aria-label="Previous month"
        className="w-8 h-8 flex items-center justify-center rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <span className="text-lg leading-none select-none">‹</span>
      </button>

      <span className="px-2 text-sm font-semibold text-gray-800 min-w-[128px] text-center select-none">
        {formatMonth(value)}
      </span>

      <button
        type="button"
        onClick={handleNext}
        disabled={isLatest}
        aria-label="Next month"
        className={`w-8 h-8 flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          isLatest
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <span className="text-lg leading-none select-none">›</span>
      </button>
    </div>
  )
}
