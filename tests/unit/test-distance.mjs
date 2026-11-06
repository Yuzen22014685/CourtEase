import { haversineKm, formatDistance, sortVenuesByDistance, isValidLocation } from '../../client/src/utils/distance.js'

let fails = 0
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -> ${JSON.stringify(got)}`); if (!ok) fails++ }
const near = (a, b, tol) => a != null && Math.abs(a - b) <= tol

const d1 = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })
check('1 degree at equator ~111.19 km', near(d1, 111.19, 0.05), d1)
const d2 = haversineKm({ lat: 5.4, lng: 100.3 }, { lat: 5.5, lng: 100.3 })
check('0.1 degree lat in Penang ~11.12 km', near(d2, 11.12, 0.05), d2)
check('same point = 0', haversineKm({ lat: 5.4, lng: 100.3 }, { lat: 5.4, lng: 100.3 }) === 0, 0)
check('missing venue location -> null', haversineKm({ lat: 5.4, lng: 100.3 }, undefined) === null, null)
check('half location -> invalid', isValidLocation({ lng: 100.3 }) === false, false)

check('0.85 km -> 850 m away', formatDistance(0.85) === '850 m away', formatDistance(0.85))
check('2.345 km -> 2.3 km away', formatDistance(2.345) === '2.3 km away', formatDistance(2.345))
check('24.6 km -> 25 km away', formatDistance(24.6) === '25 km away', formatDistance(24.6))
check('null -> empty', formatDistance(null) === '', formatDistance(null))

const venues = [
    { name: 'A', location: { lat: 5.5, lng: 100.3 } },
    { name: 'B' },
    { name: 'C', location: { lat: 5.41, lng: 100.3 } },
]
const sorted = sortVenuesByDistance(venues, { lat: 5.4, lng: 100.3 })
const order = sorted.map((v) => v.name).join(',')
check('sort order C,A,B (no coords last)', order === 'C,A,B', order)
check('input not mutated', venues[0].distanceKm === undefined, venues[0].distanceKm)

console.log(fails === 0 ? '\nALL PASSED' : `\n${fails} FAILED`)

