/** Format a number as Malaysian Ringgit */
export const formatCurrency = (amount) =>
  new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(amount ?? 0)

/** Format YYYY-MM-DD to a readable date (e.g. "Wed, 3 Sep 2026") */
export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-MY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Format "HH:MM" → "7:00 AM" */
export const formatTime = (timeStr) => {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':').map(Number)
  const date = new Date(2000, 0, 1, h, m)
  return date.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** Format an ISO date/timestamp string to Malaysia time (e.g. "24 Sept 2026, 3:45 pm") */
export const formatDateTime = (dateValue) => {
  if (!dateValue) return '—'
  const date = new Date(dateValue)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Get today as YYYY-MM-DD in local time */
export const todayString = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Get today as YYYY-MM-DD in Malaysia time (UTC+8) */
export const todayMY = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })

/** Add N days to a YYYY-MM-DD date string, returning YYYY-MM-DD */
export const addDaysISO = (dateStr, days) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + Number(days)))
  return date.toISOString().slice(0, 10)
}

// '2026-10' -> 'October 2026'
export const formatMonth = (month) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-MY', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}
// Current month in Malaysia time, e.g. '2026-10'
export const currentMonthMY = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7)

/** Check if a booking date+startTime is in the future */
export const isUpcoming = (date, startTime) => {
  if (!date || !startTime) return false
  const bookingStart = new Date(`${date}T${startTime}:00+08:00`)
  return bookingStart > new Date()
}


/** Resolve image path (external URL or local /uploads path) */
export const getImageUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '')
  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`
}

/** Format payment method string to human-readable label */
export const formatPaymentMethod = (method) => {
  switch (method) {
    case 'duitnow_qr':
      return 'DuitNow QR'
    case 'bank_transfer':
      return 'Bank transfer'
    case 'card':
      return 'Card'
    case 'fpx':
      return 'FPX'
    case 'ewallet':
      return 'e-Wallet'
    default:
      return '—'
  }
}

/** Format payment reference with fallback to receiptId or em-dash */
export const formatPaymentRef = (booking) =>
  booking?.paymentRef || booking?.receiptId || '—'

const DAY_NAMES_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// [1,2,3,4,5] -> "Mon–Fri", [0,6] -> "Sat, Sun", all 7 -> "Every day"
export const formatDays = (days = []) => {
  const idx = [...new Set(days.map((d) => (Number(d) + 6) % 7))].sort((a, b) => a - b)
  if (idx.length === 7) return 'Every day'
  const parts = []
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++
    parts.push(
      j - i >= 2
        ? `${DAY_NAMES_MON_FIRST[idx[i]]}–${DAY_NAMES_MON_FIRST[idx[j]]}`
        : idx.slice(i, j + 1).map((k) => DAY_NAMES_MON_FIRST[k]).join(', ')
    )
    i = j + 1
  }
  return parts.join(', ')
}

// "RM 24" or "RM 15–24"
export const formatPriceRange = (venue) => {
  const from = venue?.priceFrom ?? venue?.pricePerHour ?? 0
  const to = venue?.priceTo ?? from
  return from === to ? `RM ${from}` : `RM ${from}–${to}`
}

// "1 session", "2 sessions"
export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${Number(count) === 1 ? singular : plural}`
