import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'
import { homePathForRole } from '../utils/routes'

/** Owner-only routes: allows venue_owner; redirects admin → /admin/dashboard, player → /venues, unauthenticated → /login */
export default function OwnerRoute({ children }) {
  const { user, loading, isOwner } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isOwner) return <Navigate to={homePathForRole(user.role)} replace />
  return children
}
