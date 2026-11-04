import { useState } from 'react'
import { useParams, Link, useSearchParams, useLocation } from 'react-router-dom'
import { resetPassword } from '../../api/auth'
import PasswordInput from '../../components/ui/PasswordInput'
import PasswordChecklist, { checkPasswordValidity } from '../../components/ui/PasswordChecklist'
import Spinner from '../../components/ui/Spinner'
import LogoMark from '../../components/ui/LogoMark'

export default function ResetPasswordPage() {
  const { token } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isInvite = searchParams.get('invite') === '1'

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Password rules validation
  const { isValid: isPasswordValid } = checkPasswordValidity(password)
  const hasTypedConfirm = confirmPassword.length > 0
  const passwordsMatch = hasTypedConfirm && password === confirmPassword
  const showMismatch = hasTypedConfirm && password !== confirmPassword

  const isFormValid = isPasswordValid && passwordsMatch

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid || loading) return

    setLoading(true)
    setError('')
    try {
      await resetPassword(token, password)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Reset link is invalid or has expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-court-blue
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-sm mb-4">
            <LogoMark className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold text-white">CourtEase</h1>
          <p className="text-primary-200 text-sm mt-1">Find a court. Book your game.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-elevated p-7">
          {success ? (
            <div className="text-center animate-fadeIn">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                <span className="text-2xl font-bold">✓</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {isInvite ? 'Password set' : 'Password reset successful'}
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {isInvite
                  ? 'Password set. You can now log in.'
                  : 'Password updated! You can now log in with your new password.'}
              </p>
              <Link
                to="/login"
                className="btn-primary w-full btn-lg inline-flex items-center justify-center"
              >
                Go to Sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {isInvite ? 'Set your password' : 'Set new password'}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {isInvite
                  ? 'Welcome to CourtEase — choose a password for your venue owner account.'
                  : 'Create a strong password for your account'}
              </p>

              {error && (
                <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5">⚠️</span>
                    <div className="flex-1">
                      <p className="font-semibold text-red-950">{error}</p>
                      <p className="text-xs text-red-800 mt-1">
                        Need a new link?{' '}
                        <Link
                          to="/forgot-password"
                          className="font-semibold underline hover:text-red-950"
                        >
                          Request a new reset link
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="label">
                    New password
                  </label>
                  <PasswordInput
                    id="new-password"
                    name="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError('')
                    }}
                    placeholder="Min. 8 characters"
                  />
                  <PasswordChecklist password={password} />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="label">
                    Confirm password
                  </label>
                  <PasswordInput
                    id="confirm-password"
                    name="confirmPassword"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (error) setError('')
                    }}
                    placeholder="Repeat password"
                    className={showMismatch ? 'input-error' : ''}
                  />
                  {showMismatch && (
                    <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <button
                  id="reset-password-submit"
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="btn-primary w-full btn-lg mt-2"
                >
                  {loading ? <Spinner size="sm" /> : null}
                  {loading
                    ? (isInvite ? 'Setting password…' : 'Updating password…')
                    : (isInvite ? 'Set password' : 'Reset password')}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-gray-500">
                <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                  ← Back to sign in
                </Link>
              </p>
              <p className="mt-3 text-center text-xs text-gray-400">
                <Link to="/privacy" state={{ from: location.pathname }} className="hover:text-gray-600">Privacy Notice</Link>
                {' · '}
                <Link to="/terms" state={{ from: location.pathname }} className="hover:text-gray-600">Terms of Use</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
