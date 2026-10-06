/**
 * Returns the default home path for a given user role.
 * - 'admin'        → /admin/dashboard
 * - 'venue_owner'  → /owner/today
 * - other (player) → /venues
 */
export function homePathForRole(role) {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'venue_owner') return '/owner/today'
  return '/venues'
}
