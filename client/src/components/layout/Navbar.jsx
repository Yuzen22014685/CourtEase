import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  BellIcon,
  ChevronRightIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline'
import { getUnreadCount, getNotifications, markNotificationRead } from '../../api/notifications'
import { formatDistanceToNow } from 'date-fns'

export default function Navbar({ onMenuClick, pendingCount = 0 }) {
  const { user, logoutUser, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [unreadCount, setUnreadCount] = useState(0)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!user || isAdmin) return

    const fetchCount = () => {
      getUnreadCount().then(res => {
        if (res.success) setUnreadCount(res.count)
      }).catch(console.error)
    }

    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [user, isAdmin])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logoutUser()
    navigate('/login')
  }

  const toggleDropdown = () => {
    if (!isDropdownOpen) {
      getNotifications().then(res => {
        if (res.success) setNotifications(res.data)
      }).catch(console.error)
    }
    setIsDropdownOpen(!isDropdownOpen)
  }

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await markNotificationRead(notif._id)
        setUnreadCount(prev => Math.max(0, prev - 1))
        setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n))
      } catch (err) {
        console.error('Failed to mark as read', err)
      }
    }

    setIsDropdownOpen(false)

    const bookingId = notif.bookingId?._id || notif.bookingId

    let targetUrl = '/my-bookings'
    if (notif.type === 'receipt_reminder') {
      targetUrl = bookingId ? `/my-bookings?uploadReceipt=${bookingId}` : '/my-bookings'
    } else if (notif.type === 'feedback_request') {
      targetUrl = bookingId ? `/my-bookings?review=${bookingId}` : '/my-bookings'
    } else if (['booking_approved', 'booking_rejected', 'reminder', 'booking_auto_confirmed', 'booking_expired'].includes(notif.type)) {
      targetUrl = bookingId ? `/my-bookings?highlight=${bookingId}` : '/my-bookings'
    } else if (bookingId) {
      targetUrl = `/my-bookings?highlight=${bookingId}`
    }

    navigate(targetUrl)
  }

  const homeLink = isAdmin ? '/admin/dashboard' : '/venues'

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Admin Hamburger */}
          <div className="flex items-center gap-2">
            {isAdmin && onMenuClick && (
              <button
                type="button"
                onClick={onMenuClick}
                className="lg:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 relative focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Open navigation menu"
              >
                <Bars3Icon className="h-6 w-6" />
                {pendingCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
            )}

            {/* Logo */}
            <Link to={homeLink} className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center
                              group-hover:bg-primary-700 transition-colors">
                <span className="text-white text-lg" aria-hidden>🏸</span>
              </div>
              <span className="font-bold text-gray-900 text-lg tracking-tight">
                Court<span className="text-primary-600">Ease</span>
              </span>
            </Link>
          </div>

          {/* Player nav links */}
          {!isAdmin && user && (
            <nav className="hidden sm:flex items-center gap-1">
              <Link to="/venues"
                className="px-3 py-2 text-sm font-medium text-gray-600 rounded-lg
                               hover:text-primary-700 hover:bg-primary-50 transition-colors">
                Venues
              </Link>
              <Link to="/my-bookings"
                className="px-3 py-2 text-sm font-medium text-gray-600 rounded-lg
                               hover:text-primary-700 hover:bg-primary-50 transition-colors">
                My Bookings
              </Link>
              <Link to="/profile"
                className="px-3 py-2 text-sm font-medium text-gray-600 rounded-lg
                               hover:text-primary-700 hover:bg-primary-50 transition-colors">
                Profile
              </Link>
            </nav>
          )}

          {/* Right side */}
          {user ? (
            <div className="flex items-center gap-3">
              {!isAdmin && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={toggleDropdown}
                    className="relative p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <span className="sr-only">View notifications</span>
                    <BellIcon className="h-6 w-6" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 block h-4 min-w-[16px] rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center px-1 ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 overflow-hidden">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-gray-500">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map(notif => {
                            const isClickable = notif.type !== 'feedback_request'
                            const Component = isClickable ? 'button' : 'div'
                            return (
                              <Component
                                key={notif._id}
                                onClick={isClickable ? () => handleNotificationClick(notif) : undefined}
                                className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3 transition-colors ${!notif.isRead ? 'bg-blue-50/50' : ''
                                  } ${isClickable
                                    ? 'cursor-pointer hover:bg-gray-50 group'
                                    : 'cursor-default'
                                  }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${!notif.isRead ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                    {notif.message}
                                  </p>
                                  <p className={`text-xs mt-1 ${!notif.isRead ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>
                                    {formatDistanceToNow(new Date(notif.sentAt), { addSuffix: true })}
                                  </p>
                                </div>
                                {!notif.isRead && (
                                  <div className="flex-shrink-0">
                                    <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                                  </div>
                                )}
                                {isClickable && (
                                  <ChevronRightIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
                                )}
                              </Component>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="hidden sm:flex items-center gap-2 text-sm ml-2 pl-2 border-l border-gray-200">
                <UserCircleIcon className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-700">{user.fullName}</span>
                {isAdmin && (
                  <span className="badge bg-primary-100 text-primary-700 text-xs">Admin</span>
                )}
              </div>
              <button
                id="logout-btn"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600
                           rounded-lg hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary btn-sm">Login</Link>
              <Link to="/register" className="btn-primary btn-sm">Register</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
