import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../api/auth'
import Spinner from '../../components/ui/Spinner'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || loading || countdown > 0) return

    setLoading(true)
    try {
      await forgotPassword(email.trim())
    } catch (err) {
      // Security requirement: Always show same generic response even if API fails or rate-limits
      console.warn('Password reset request error:', err)
    } finally {
      setLoading(false)
      setSubmitted(true)
      setCountdown(60)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600
                    flex items-center justify-center p-4">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 25%, white 2px, transparent 0), radial-gradient(circle at 75% 75%, white 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative w-full max-w-sm animate-slideUp">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
            <span className="text-3xl">🏸</span>
          </div>
          <h1 className="text-3xl font-bold text-white">CourtEase</h1>
          <p className="text-primary-200 text-sm mt-1">Penang's badminton booking platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-elevated p-7">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Forgot password?</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter your email and we'll send you a link to reset your password.
          </p>

          {submitted && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <span className="text-base mt-0.5">✉️</span>
                <div>
                  <p className="font-semibold text-emerald-950">Check your email</p>
                  <p className="text-xs text-emerald-800 mt-1">
                    If an account exists for this email, a password reset link has been sent.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>

            <button
              id="forgot-password-submit"
              type="submit"
              disabled={loading || !email.trim() || countdown > 0}
              className="btn-primary w-full btn-lg mt-2"
            >
              {loading ? <Spinner size="sm" /> : null}
              {loading
                ? 'Sending link…'
                : countdown > 0
                ? `Resend link in ${countdown}s`
                : 'Send reset link'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
