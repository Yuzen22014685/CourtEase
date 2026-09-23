import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center animate-fadeIn">
        <p className="text-8xl mb-6">🏸</p>
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Page not found</h2>
        <p className="text-sm text-gray-500 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="btn-primary">Back to Home</Link>
      </div>
    </div>
  )
}
