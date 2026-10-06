import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'

/** Staff routes (admin & venue_owner): blocks players → /venues */
export default function AdminRoute({ children }) {
  const { user, loading, isStaff } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isStaff) return <Navigate to="/venues" replace />
  return children
}
