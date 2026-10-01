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
