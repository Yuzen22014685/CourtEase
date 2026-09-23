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

/**
 * Returns true when a user object has both a non-empty address and a
 * non-empty bankAccount.accountNumber.  This is the single source of truth
 * for profile completeness — used by AuthContext, LoginPage, and
 * RegisterPage so the formula never drifts.
 *
 * @param {object|null} user - raw user object (from API response or auth state)
 */
export const checkProfileComplete = (user) =>
  Boolean(
    user?.address?.trim() &&
    user?.bankAccount?.accountNumber?.trim()
  )
