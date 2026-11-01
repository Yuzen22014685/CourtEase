import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'
import { homePathForRole } from '../utils/routes'

/** Public player routes: blocks staff (admin & venue_owner) → uses homePathForRole; allows guests and players */
export default function PublicPlayerRoute({ children }) {
  const { user, loading, isAdmin, isOwner } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isAdmin || isOwner) return <Navigate to={homePathForRole(user.role)} replace />
  return children
}

