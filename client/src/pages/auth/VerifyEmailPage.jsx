import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { verifyEmail, resendVerification } from '../../api/auth'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import TurnstileWidget from '../../components/ui/TurnstileWidget'
import LogoMark from '../../components/ui/LogoMark'

export default function VerifyEmailPage() {
  const { token } = useParams()
  const calledRef = useRef(false)

  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('')

  // Resend form states on failure
  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [resendStatus, setResendStatus] = useState('')
  const [resendError, setResendError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState(null)
  const [turnstileError, setTurnstileError] = useState('')
  const [widgetKey, setWidgetKey] = useState(0)

  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    if (!token) {
      setStatus('error')
      setErrorMessage('Verification token is missing.')
      return
    }

    const performVerification = async () => {
      try {
        await verifyEmail(token)
        setStatus('success')
      } catch (err) {
        setStatus('error')
        setErrorMessage(
          err.response?.data?.message || 'Verification link is invalid or has expired.'
        )
      }
    }

    performVerification()
  }, [token])

  const handleResend = async (e) => {
    e.preventDefault()
    if (resendCountdown > 0 || resending || !resendEmail.trim() || !turnstileToken) return

    setResending(true)
    setResendError('')
    setResendStatus('')

    try {
      const res = await resendVerification(resendEmail.trim(), turnstileToken)
      setResendStatus(
        res.data?.message || 'If an unverified account exists, a new verification link has been sent.'
      )
      setResendCountdown(60)
    } catch (err) {
      setResendError(err.response?.data?.message || 'Failed to resend verification email.')
    } finally {
      setResending(false)
      setTurnstileToken(null)
      setWidgetKey((k) => k + 1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-court-blue
                    flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10"
           style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 2px, transparent 0), radial-gradient(circle at 75% 75%, white 2px, transparent 0)', backgroundSize: '50px 50px' }} />

      <div className="relative w-full max-w-md animate-slideUp">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-sm mb-4">
            <LogoMark className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold text-white">CourtEase</h1>
          <p className="text-primary-200 text-sm mt-1">Find a court. Book your game.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-elevated p-7 text-center">
          {status === 'loading' && (
            <div className="py-8 space-y-4">
              <Spinner size="lg" className="mx-auto" />
              <h2 className="text-xl font-semibold text-gray-900">Verifying your email…</h2>
              <p className="text-sm text-gray-500">Please wait while we confirm your account.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mb-2">
                <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-gray-900">Email verified!</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Email verified! You can now log in.
              </p>

              <div className="pt-4">
                <Link
                  to="/login"
                  id="verified-login-btn"
                  className="btn-primary w-full btn-lg flex items-center justify-center"
                >
                  Go to Sign in
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 text-amber-600 mb-2">
                <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-gray-900">Verification Failed</h2>
              <p className="text-sm text-gray-600">
                {errorMessage || 'Verification link is invalid or has expired.'}
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left mt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Request a new link</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Enter your email address below to receive a new verification link.
                </p>

                <ErrorMessage message={resendError} className="mb-3 text-xs" />

                {resendStatus && (
                  <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                    {resendStatus}
                  </div>
                )}

                <form onSubmit={handleResend} className="space-y-2">
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input text-sm"
                  />

                  <TurnstileWidget
                    key={widgetKey}
                    onToken={setTurnstileToken}
                    onError={setTurnstileError}
                  />
                  {turnstileError && (
                    <p className="text-xs text-red-500 text-center">{turnstileError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={resendCountdown > 0 || resending || !resendEmail.trim() || !turnstileToken}
                    className={`w-full py-2 px-3 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                      resendCountdown > 0 || !resendEmail.trim() || !turnstileToken
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'btn-primary'
                    }`}
                  >
                    {resending && <Spinner size="sm" />}
                    {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend verification email'}
                  </button>
                </form>
              </div>

              <div className="pt-2">
                <Link to="/login" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                  Back to sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
