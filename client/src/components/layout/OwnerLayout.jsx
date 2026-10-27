import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOwnerVenue } from '../../context/OwnerVenueContext'
import { getPendingCount } from '../../api/admin'
import Spinner from '../ui/Spinner'
import {
  CalendarDaysIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  SparklesIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline'

const tabs = [
  { to: '/owner/today', label: 'Today', icon: SparklesIcon },
  { to: '/owner/bookings', label: 'Bookings', icon: CalendarDaysIcon, hasBadge: true },
  { to: '/owner/venue', label: 'My Venue', icon: BuildingOffice2Icon },
  { to: '/owner/shop', label: 'Shop', icon: ShoppingBagIcon },
  { to: '/owner/reviews', label: 'Reviews', icon: ChatBubbleLeftRightIcon },
  { to: '/owner/insights', label: 'Insights', icon: ChartBarIcon },
]

export default function OwnerLayout() {
  const { user, logoutUser } = useAuth()
  const { venues, selectedVenue, setSelectedVenueId, loading: venuesLoading } = useOwnerVenue()
  const navigate = useNavigate()

  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await getPendingCount()
        setPendingCount(res.data?.count ?? 0)
      } catch {
        // silently ignore
      }
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30_000)

    const handleCountChanged = () => fetchCount()
    window.addEventListener('pending-count-changed', handleCountChanged)

    return () => {
      clearInterval(interval)
      window.removeEventListener('pending-count-changed', handleCountChanged)
    }
  }, [])

  const handleLogout = async () => {
    await logoutUser()
    navigate('/login')
  }

  const badgeDisplay = pendingCount > 99 ? '99+' : pendingCount

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Main Owner Header ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand + Venue Name / Switcher */}
            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              <Link to="/owner/today" className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-base">
                  🏸
                </div>
                <span className="font-bold text-gray-900 text-base sm:text-lg tracking-tight hidden sm:inline">
                  Court<span className="text-primary-600">Ease</span>
                </span>
              </Link>

              {/* Venue Info / Switcher */}
              {!venuesLoading && selectedVenue && (
                <div className="min-w-0 flex items-center">
                  <div className="h-5 w-px bg-gray-200 mr-3 hidden sm:block" />
                  {venues.length > 1 ? (
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="owner-venue-switcher" className="sr-only">
                        Select venue
                      </label>
                      <select
                        id="owner-venue-switcher"
                        value={selectedVenue._id}
                        onChange={(e) => setSelectedVenueId(e.target.value)}
                        className="text-xs sm:text-sm font-semibold text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer max-w-[180px] sm:max-w-[260px] truncate"
                      >
                        {venues.map((v) => (
                          <option key={v._id} value={v._id}>
                            {v.name} ({v.area})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {selectedVenue.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate -mt-0.5">
                        {selectedVenue.area}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Owner Name & Logout */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <UserCircleIcon className="h-5 w-5 text-gray-400" />
                <span className="font-medium hidden sm:inline">{user?.fullName}</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-full">
                  Owner
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Desktop Horizontal Tab Bar (under header) ── */}
        {!venuesLoading && venues.length > 0 && (
          <div className="hidden sm:block border-t border-gray-100 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav className="flex space-x-2 py-2 overflow-x-auto">
                {tabs.map(({ to, label, icon: Icon, hasBadge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-semibold shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                    {hasBadge && pendingCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {badgeDisplay}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* ── Page Content Area ── */}
      <main className="flex-1 pb-20 sm:pb-8">
        {venuesLoading ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : venues.length === 0 ? (
          <div className="max-w-md mx-auto py-20 px-4 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm">
              🏸
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No venue assigned yet</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              You are signed in as a venue owner, but no venues are assigned to your account yet.
              Please contact the CourtEase admin to have your venue connected.
            </p>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <Outlet />
          </div>
        )}
      </main>

      {/* ── Mobile Fixed Bottom Navigation Bar (<640px) ── */}
      {!venuesLoading && venues.length > 0 && (
        <nav
          aria-label="Mobile Bottom Navigation"
          className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 flex justify-around items-center h-16 px-1 safe-bottom shadow-lg"
        >
          {tabs.map(({ to, label, icon: Icon, hasBadge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg ${
                  isActive ? 'text-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-800'
                }`
              }
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {hasBadge && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2.5 inline-flex items-center justify-center min-w-[1rem] h-3.5 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                    {badgeDisplay}
                  </span>
                )}
              </div>
              <span className="mt-1 truncate max-w-[52px]">{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
