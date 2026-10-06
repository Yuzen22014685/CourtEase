import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'

/** Player-only routes: blocks staff (admin & venue_owner) → /admin/dashboard */
export default function PlayerRoute({ children }) {
  const { user, loading, isStaff } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (isStaff) return <Navigate to="/admin/dashboard" replace />
  return children
}
