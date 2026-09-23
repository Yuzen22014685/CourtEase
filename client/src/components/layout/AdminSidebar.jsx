import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  HomeIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  ChartBarIcon as ChartBarIconSolid,
} from '@heroicons/react/24/solid'

const navItems = [
  {
    to: '/admin/dashboard',
    label: 'Dashboard',
    icon: HomeIcon,
    activeIcon: HomeIconSolid,
  },
  {
    to: '/admin/venues',
    label: 'Venues',
    icon: BuildingOffice2Icon,
    activeIcon: BuildingOffice2IconSolid,
  },
  {
    to: '/admin/bookings',
    label: 'Bookings',
    icon: CalendarDaysIcon,
    activeIcon: CalendarDaysIconSolid,
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    icon: ChartBarIcon,
    activeIcon: ChartBarIconSolid,
  },
]

export default function AdminSidebar() {
  const { user } = useAuth()
  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col bg-white border-r border-gray-100 min-h-screen">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <span className="text-white text-lg">🏸</span>
          </div>
          <div>
            <span className="font-bold text-gray-900">Court<span className="text-primary-600">Ease</span></span>
            <p className="text-xs text-gray-400">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, activeIcon: ActiveIcon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
               ${isActive
                 ? 'bg-primary-50 text-primary-700'
                 : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
               }`
            }
          >
            {({ isActive }) =>
              isActive
                ? <><ActiveIcon className="h-5 w-5 text-primary-600" />{label}</>
                : <><Icon className="h-5 w-5" />{label}</>
            }
          </NavLink>
        ))}
      </nav>

      {/* User info at bottom */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 text-xs font-bold">
              {user?.fullName?.charAt(0) ?? 'A'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
