// Straight-line ("as the crow flies") distance between two points using the
// Haversine formula. Pure functions: no API calls, no keys, no cost.
// Locations are { lat, lng } in decimal degrees (same shape as Venue.location).

const EARTH_RADIUS_KM = 6371

const toRad = (deg) => (deg * Math.PI) / 180

// True only for a complete, in-range { lat, lng } pair.
export function isValidLocation(loc) {
    return (
        loc != null &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng) &&
        loc.lat >= -90 &&
        loc.lat <= 90 &&
        loc.lng >= -180 &&
        loc.lng <= 180
    )
}

// Distance in km between two { lat, lng } points, or null if either is missing/invalid.
export function haversineKm(from, to) {
    if (!isValidLocation(from) || !isValidLocation(to)) return null
    const dLat = toRad(to.lat - from.lat)
    const dLng = toRad(to.lng - from.lng)
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c
}

// "850 m away" (< 1 km, nearest 10 m), "2.3 km away" (< 10 km), "24 km away" (>= 10 km).
export function formatDistance(km) {
    if (km == null || !Number.isFinite(km) || km < 0) return ''
    if (km < 1) {
        const metres = Math.max(10, Math.round(km * 100) * 10)
        return metres >= 1000 ? '1.0 km away' : `${metres} m away`
    }
    if (km < 9.95) return `${km.toFixed(1)} km away`
    return `${Math.round(km)} km away`
}

// Returns a NEW array (input not mutated). Each venue gets distanceKm (number or null).
// Nearest first; venues without coordinates go last, keeping their original order.
export function sortVenuesByDistance(venues, userLocation) {
    return venues
        .map((v) => ({ ...v, distanceKm: haversineKm(userLocation, v.location) }))
        .sort((a, b) => {
            if (a.distanceKm == null && b.distanceKm == null) return 0
            if (a.distanceKm == null) return 1
            if (b.distanceKm == null) return -1
            return a.distanceKm - b.distanceKm
        })
}