import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { login } from '../../api/auth'
import { checkProfileComplete } from '../../utils/format'
import ErrorMessage from '../../components/ui/ErrorMessage'
import Spinner from '../../components/ui/Spinner'

export default function LoginPage() {
  const navigate = useNavigate()
  const { loginUser } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await login(form)
      const data = res.data.data
      loginUser(data)
      if (data.role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else if (!checkProfileComplete(data)) {
        // Profile incomplete — redirect to profile page before venue browsing
        navigate('/profile', { replace: true })
      } else {
        navigate('/venues', { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600
                    flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10"
           style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 2px, transparent 0), radial-gradient(circle at 75% 75%, white 2px, transparent 0)', backgroundSize: '50px 50px' }} />

      <div className="relative w-full max-w-sm animate-slideUp">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20
                          backdrop-blur-sm mb-4">
            <span className="text-3xl">🏸</span>
          </div>
          <h1 className="text-3xl font-bold text-white">CourtEase</h1>
          <p className="text-primary-200 text-sm mt-1">Penang's badminton booking platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-elevated p-7">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in to book your court</p>

          <ErrorMessage message={error} className="mb-5" />

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                className={`input ${error ? 'input-error' : ''}`}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                className={`input ${error ? 'input-error' : ''}`}
                placeholder="••••••••"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading || !form.email || !form.password}
              className="btn-primary w-full btn-lg mt-2"
            >
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
              Register here
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-primary-200 mt-4">
          Demo — Admin: admin@courtease.my · Player: player1@courtease.my
        </p>
      </div>
    </div>
  )
}
