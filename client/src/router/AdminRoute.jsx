import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'
import { homePathForRole } from '../utils/routes'

/** Admin-only routes: allows admin; redirects owners → /owner/today, players → /venues, unauthenticated → /login */
export default function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to={homePathForRole(user.role)} replace />
  return children
}
