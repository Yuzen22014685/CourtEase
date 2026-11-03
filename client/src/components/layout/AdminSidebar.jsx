import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useEffect, useState } from 'react'
import {
  getPendingCount,
  getSubmittedCommissionCount,
  getAdminEventReviewCount,
} from '../../api/admin'
import {
  HomeIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  XMarkIcon,
  UserGroupIcon,
  BanknotesIcon,
  UserCircleIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  MegaphoneIcon as MegaphoneIconSolid,
} from '@heroicons/react/24/solid'
  import LogoMark from '../ui/LogoMark'

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
    to: '/admin/owners',
    label: 'Owners',
    icon: UserGroupIcon,
    activeIcon: UserGroupIconSolid,
  },
  {
    to: '/admin/reviews',
    label: 'Reviews',
    icon: ChatBubbleLeftRightIcon,
    activeIcon: ChatBubbleLeftRightIconSolid,
  },
  {
    to: '/admin/events',
    label: 'Events',
    icon: MegaphoneIcon,
    activeIcon: MegaphoneIconSolid,
    showEventReviewBadge: true,
  },
  {
    to: '/admin/bookings',
    label: 'Bookings',
    icon: CalendarDaysIcon,
    activeIcon: CalendarDaysIconSolid,
    showPendingBadge: true,
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    icon: ChartBarIcon,
    activeIcon: ChartBarIconSolid,
  },
  {
    to: '/admin/commission',
    label: 'Commission',
    icon: BanknotesIcon,
    activeIcon: BanknotesIconSolid,
    showCommissionBadge: true,
  },
  {
    to: '/admin/account',
    label: 'My Account',
    icon: UserCircleIcon,
    activeIcon: UserCircleIconSolid,
  },
]

export default function AdminSidebar({
  isOpen = false,
  onClose,
  pendingCount: propPendingCount,
  commissionCount: propCommissionCount,
  eventReviewCount: propEventReviewCount,
}) {
  const { user } = useAuth()
  const location = useLocation()
  const [localPendingCount, setLocalPendingCount] = useState(0)
  const [localCommissionCount, setLocalCommissionCount] = useState(0)
  const [localEventReviewCount, setLocalEventReviewCount] = useState(0)

  // Review count: mount effect (interval + listener created ONCE)
  useEffect(() => {
    if (propEventReviewCount !== undefined) return

    const fetchReviewCount = async () => {
      try {
        const res = await getAdminEventReviewCount()
        setLocalEventReviewCount(res.data?.count ?? 0)
      } catch {
        // silently ignore — badge won't show if the request fails
      }
    }

    fetchReviewCount()
    const interval = setInterval(fetchReviewCount, 30_000)

    const handleEventsChanged = () => fetchReviewCount()
    window.addEventListener('ce:admin-events-changed', handleEventsChanged)

    return () => {
      clearInterval(interval)
      window.removeEventListener('ce:admin-events-changed', handleEventsChanged)
    }
  }, [propEventReviewCount])

  // Review count: route-change effect (only calls fetch)
  useEffect(() => {
    if (propEventReviewCount !== undefined) return

    const fetchReviewCount = async () => {
      try {
        const res = await getAdminEventReviewCount()
        setLocalEventReviewCount(res.data?.count ?? 0)
      } catch {
        // silently ignore
      }
    }

    fetchReviewCount()
  }, [location.pathname, propEventReviewCount])

  useEffect(() => {
    if (propCommissionCount !== undefined) return

    const fetchCommission = async () => {
      try {
        const res = await getSubmittedCommissionCount()
        setLocalCommissionCount(res.data?.count ?? 0)
      } catch {
        // silently ignore
      }
    }

    fetchCommission()
    const interval = setInterval(fetchCommission, 60_000)

    const handleCommissionChanged = () => fetchCommission()
    window.addEventListener('commission-count-changed', handleCommissionChanged)

    return () => {
      clearInterval(interval)
      window.removeEventListener('commission-count-changed', handleCommissionChanged)
    }
  }, [propCommissionCount])

  useEffect(() => {
    if (propPendingCount !== undefined) return

    const fetchCount = async () => {
      try {
        const res = await getPendingCount()
        setLocalPendingCount(res.data?.count ?? 0)
      } catch {
        // silently ignore — badge just won't show if the request fails
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
  }, [propPendingCount])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close drawer if screen resizes to desktop breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isOpen) {
        onClose?.()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, onClose])

  const pendingCount = propPendingCount !== undefined ? propPendingCount : localPendingCount
  const badgeLabel = pendingCount > 99 ? '99+' : String(pendingCount)

  const commissionCount = propCommissionCount !== undefined ? propCommissionCount : localCommissionCount
  const commissionBadgeLabel = commissionCount > 99 ? '99+' : String(commissionCount)

  const eventReviewCount = propEventReviewCount !== undefined ? propEventReviewCount : localEventReviewCount
  const eventReviewBadgeLabel = eventReviewCount > 99 ? '99+' : String(eventReviewCount)

  const renderNav = (onItemClick) => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navItems.map(({ to, label, icon: Icon, activeIcon: ActiveIcon, showPendingBadge, showCommissionBadge, showEventReviewBadge }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onItemClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
             ${isActive
               ? 'bg-primary-50 text-primary-700'
               : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
             }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? <ActiveIcon className="h-5 w-5 text-primary-600" /> : <Icon className="h-5 w-5" />}
              <span className="flex-1">{label}</span>
              {showPendingBadge && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {badgeLabel}
                </span>
              )}
              {showCommissionBadge && commissionCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none">
                  {commissionBadgeLabel}
                </span>
              )}
              {showEventReviewBadge && eventReviewCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {eventReviewBadgeLabel}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )

  const renderUserInfo = (onItemClick) => (
    <div className="px-3 py-3 border-t border-gray-100">
      <Link
        to="/admin/account"
        onClick={onItemClick}
        title="My Account"
        aria-label="My Account"
        className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors group"
      >
        <div className="w-8 h-8 rounded-full bg-primary-100 group-hover:bg-primary-200 transition-colors flex items-center justify-center shrink-0">
          <span className="text-primary-700 text-xs font-bold">
            {user?.fullName?.charAt(0) ?? 'A'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors truncate">
            {user?.fullName}
          </p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        </div>
      </Link>
    </div>
  )

  return (
    <>
      {/* ── Mobile slide-in drawer (below lg) ── */}
      <div className="lg:hidden">
        {/* Semi-transparent dark overlay */}
        <div
          className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Slide-in drawer container */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Admin Navigation Drawer"
        >
          {/* Brand header with close button */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <LogoMark className="h-8 w-8" />
              </div>
              <div>
                <span className="font-bold text-court-blue">Court<span className="text-primary-600">Ease</span></span>
                <p className="text-xs text-gray-400">Admin Console</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close sidebar"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Nav */}
          {renderNav(onClose)}

          {/* User info at bottom */}
          {renderUserInfo(onClose)}
        </aside>
      </div>

      {/* ── Desktop fixed sidebar (lg and up) ── */}
      <aside className="w-64 shrink-0 hidden lg:flex flex-col bg-white border-r border-gray-100 min-h-screen">
        {/* Nav */}
        {renderNav()}

        {/* User info at bottom */}
        {renderUserInfo()}
      </aside>
    </>
  )
}
