import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  TicketIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'

export default function PlayerTabBar() {
  const { user, isStaff } = useAuth()
  const location = useLocation()

  if (isStaff) return null

  const tabs = user
    ? [
        { to: '/venues', label: 'Venues', icon: BuildingStorefrontIcon },
        { to: '/events', label: 'Events', icon: CalendarDaysIcon },
        { to: '/my-bookings', label: 'Bookings', icon: TicketIcon },
        { to: '/profile', label: 'Profile', icon: UserCircleIcon },
      ]
    : [
        { to: '/venues', label: 'Venues', icon: BuildingStorefrontIcon },
        { to: '/events', label: 'Events', icon: CalendarDaysIcon },
        {
          to: '/login',
          label: 'Sign in',
          icon: UserCircleIcon,
          state: { from: location.pathname + location.search },
        },
      ]

  return (
    <nav
      aria-label="Main navigation"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 flex justify-around items-center h-16 px-1 shadow-lg"
    >
      {tabs.map(({ to, label, icon: Icon, state }) => (
        <NavLink
          key={to}
          to={to}
          state={state}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg ${
              isActive ? 'text-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-800'
            }`
          }
        >
          <div className="relative">
            <Icon className="h-5 w-5" />
          </div>
          <span className="mt-1 truncate max-w-full">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

