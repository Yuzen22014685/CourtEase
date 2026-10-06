import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { homePathForRole } from '../../utils/routes'
import { login, resendVerification } from '../../api/auth'
import PasswordInput from '../../components/ui/PasswordInput'
import ErrorMessage from '../../components/ui/ErrorMessage'
import Spinner from '../../components/ui/Spinner'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loginUser } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(homePathForRole(user.role), { replace: true })
    }
  }, [user, navigate])

  // Unverified email handling
  const [notVerified, setNotVerified] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [resendStatus, setResendStatus] = useState('')

  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
    if (notVerified) {
      setNotVerified(false)
      setResendStatus('')
    }
  }

  const handleResend = async () => {
    if (resendCountdown > 0 || resending || !form.email) return
    setResending(true)
    setResendStatus('')
    try {
      const res = await resendVerification(form.email)
      setResendStatus(res.data?.message || 'Verification link sent! Please check your inbox.')
      setResendCountdown(60)
    } catch (err) {
      setResendStatus(err.response?.data?.message || 'Failed to resend verification email.')
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotVerified(false)
    setResendStatus('')

    try {
      const res = await login(form)
      const data = res.data.data
      loginUser(data)
      navigate(homePathForRole(data.role), { replace: true })
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setNotVerified(true)
        setError('')
      } else {
        setError(err.response?.data?.message || 'Login failed. Please try again.')
      }
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

          {notVerified && (
            <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <span className="text-base mt-0.5">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold text-amber-950">Please verify your email before logging in.</p>
                  <p className="text-xs text-amber-800 mt-1">
                    A verification link was sent to <strong>{form.email}</strong>.
                  </p>

                  {resendStatus && (
                    <div className="mt-2 p-2 bg-white/80 rounded border border-amber-300 text-xs text-amber-900 font-medium">
                      {resendStatus}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCountdown > 0 || resending}
                    className="mt-2 text-xs font-semibold text-amber-900 hover:text-amber-950 underline disabled:opacity-50 disabled:no-underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {resending && <Spinner size="sm" />}
                    {resendCountdown > 0 ? `Resend email in ${resendCountdown}s` : 'Resend verification email'}
                  </button>
                </div>
              </div>
            </div>
          )}

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
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                className={error ? 'input-error' : ''}
                placeholder="••••••••"
              />
              <div className="flex justify-end mt-1.5">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
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
