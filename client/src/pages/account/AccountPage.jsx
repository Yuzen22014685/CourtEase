import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/layout/AdminLayout'
import ChangePasswordCard from '../../components/account/ChangePasswordCard'
import { UserCircleIcon } from '@heroicons/react/24/outline'

export default function AccountPage({ noLayout = false }) {
  const { user, isOwner } = useAuth()
  const location = useLocation()

  const roleLabel =
    user?.role === 'admin'
      ? 'Admin'
      : user?.role === 'venue_owner'
      ? 'Venue owner'
      : user?.role || ''

  const content = (
    <div className="page-container max-w-2xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="page-title mb-1">My Account</h1>
        <p className="text-sm text-gray-500">
          Your login details and password.
        </p>
      </div>

      {/* Account card */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCircleIcon className="h-5 w-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Account</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              className="input bg-gray-50 cursor-not-allowed text-gray-600"
              value={user?.fullName || ''}
              readOnly
            />
          </div>
          <div>
            <label className="label">Email address</label>
            <input
              type="email"
              className="input bg-gray-50 cursor-not-allowed text-gray-600"
              value={user?.email || ''}
              readOnly
            />
          </div>
          <div>
            <label className="label">Role</label>
            <input
              type="text"
              className="input bg-gray-50 cursor-not-allowed text-gray-600"
              value={roleLabel}
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Change password card */}
      <ChangePasswordCard />

      {/* Legal links */}
      <p className="text-center text-xs text-gray-400 mt-2">
        <Link to="/privacy" state={{ from: location.pathname }} className="hover:text-gray-600">Privacy Notice</Link>
        {' · '}
        <Link to="/terms" state={{ from: location.pathname }} className="hover:text-gray-600">Terms of Use</Link>
      </p>
    </div>
  )

  if (noLayout || isOwner) return content
  return <AdminLayout>{content}</AdminLayout>
}
