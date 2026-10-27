import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resendVerification } from '../../api/auth'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import TurnstileWidget from '../../components/ui/TurnstileWidget'

export default function CheckEmailPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''

  const [countdown, setCountdown] = useState(0)
  const [resending, setResending] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState(null)
  const [turnstileError, setTurnstileError] = useState('')
  const [widgetKey, setWidgetKey] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleResend = async () => {
    if (countdown > 0 || resending || !email || !turnstileToken) return
    setResending(true)
    setError('')
    setStatusMessage('')
    try {
      const res = await resendVerification(email, turnstileToken)
      setStatusMessage(res.data?.message || 'A new verification link has been sent if an unverified account exists.')
      setCountdown(60)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend verification email. Please try again.')
    } finally {
      setResending(false)
      setTurnstileToken(null)
      setWidgetKey((k) => k + 1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600
                    flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10"
           style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 2px, transparent 0), radial-gradient(circle at 75% 75%, white 2px, transparent 0)', backgroundSize: '50px 50px' }} />

      <div className="relative w-full max-w-md animate-slideUp">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
            <span className="text-3xl">🏸</span>
          </div>
          <h1 className="text-3xl font-bold text-white">CourtEase</h1>
          <p className="text-primary-200 text-sm mt-1">Penang's badminton booking platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-elevated p-7 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 text-primary-600 mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-sm text-gray-600 mb-4">
            We've sent a verification link to:
          </p>

          {email ? (
            <div className="inline-block max-w-full font-semibold text-primary-800 bg-primary-50 border border-primary-100 rounded-lg px-4 py-2 text-sm break-all mb-4">
              {email}
            </div>
          ) : (
            <div className="inline-block font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm mb-4">
              your registered email address
            </div>
          )}

          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Please click the button in that email to activate your account. If you don't see it within a few moments, be sure to check your <strong>spam or junk folder</strong>.
          </p>

          <ErrorMessage message={error} className="mb-4 text-left" />

          {statusMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
              {statusMessage}
            </div>
          )}

          <div className="space-y-3">
            <TurnstileWidget
              key={widgetKey}
              onToken={setTurnstileToken}
              onError={setTurnstileError}
            />
            {turnstileError && (
              <p className="text-xs text-red-500 text-center">{turnstileError}</p>
            )}

            <button
              id="resend-verification-btn"
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || resending || !email || !turnstileToken}
              className={`w-full btn-lg font-medium rounded-xl transition-all duration-150 flex items-center justify-center gap-2 ${
                countdown > 0 || !email || !turnstileToken
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'btn-primary'
              }`}
            >
              {resending && <Spinner size="sm" />}
              {countdown > 0 ? `Resend email in ${countdown}s` : 'Resend verification email'}
            </button>

            <Link
              to="/login"
              className="inline-block text-sm font-medium text-primary-600 hover:text-primary-700 pt-2"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
