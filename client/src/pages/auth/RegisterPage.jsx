import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../../api/auth'
import PasswordInput from '../../components/ui/PasswordInput'
import ErrorMessage from '../../components/ui/ErrorMessage'
import Spinner from '../../components/ui/Spinner'

const INITIAL = {
  fullName: '',
  gender: '',
  phone: '',
  address: '',
  email: '',
  password: '',
  confirmPassword: '',
  skillLevel: 'Beginner',
}

export default function RegisterPage() {
  const navigate  = useNavigate()

  const [form, setForm]     = useState(INITIAL)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // Password rules validation
  const hasMinLength = form.password.length >= 8
  const hasLetter    = /[a-zA-Z]/.test(form.password)
  const hasNumber    = /[0-9]/.test(form.password)
  const isPasswordValid = hasMinLength && hasLetter && hasNumber

  const hasTypedConfirm = form.confirmPassword.length > 0
  const passwordsMatch  = hasTypedConfirm && form.password === form.confirmPassword
  const showMismatch    = hasTypedConfirm && form.password !== form.confirmPassword

  const rules = [
    { label: 'At least 8 characters', met: hasMinLength },
    { label: 'Contains a letter', met: hasLetter },
    { label: 'Contains a number', met: hasNumber },
  ]

  const isFormValid =
    Boolean(form.fullName.trim()) &&
    Boolean(form.email.trim()) &&
    Boolean(form.gender) &&
    isPasswordValid &&
    passwordsMatch

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid) return

    setLoading(true)
    setError('')
    try {
      // Exclude confirmPassword so it is never sent to the backend
      const { confirmPassword: _, ...payload } = form
      await register(payload)
      navigate(`/check-email?email=${encodeURIComponent(form.email)}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600
                    flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10"
           style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 2px, transparent 0), radial-gradient(circle at 75% 75%, white 2px, transparent 0)', backgroundSize: '50px 50px' }} />

      <div className="relative w-full max-w-md animate-slideUp">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
            <span className="text-3xl">🏸</span>
          </div>
          <h1 className="text-3xl font-bold text-white">CourtEase</h1>
          <p className="text-primary-200 text-sm mt-1">Create your player account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-elevated p-7">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Create account</h2>
          <p className="text-sm text-gray-500 mb-6">Start booking courts in Penang today</p>

          <ErrorMessage message={error} className="mb-5" />

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label htmlFor="fullName" className="label">Full name</label>
                <input id="fullName" name="fullName" type="text" required
                       value={form.fullName} onChange={handleChange}
                       className="input" placeholder="Ahmad Faris" />
              </div>

              <div>
                <label htmlFor="gender" className="label">Gender</label>
                <select id="gender" name="gender" required
                        value={form.gender} onChange={handleChange}
                        className="select">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label htmlFor="skillLevel" className="label">Skill level</label>
                <select id="skillLevel" name="skillLevel"
                        value={form.skillLevel} onChange={handleChange}
                        className="select">
                  <option value="Beginner">Beginner</option>
                  <option value="Pro">Pro</option>
                  <option value="Athlete">Athlete</option>
                </select>
              </div>

              <div className="col-span-2">
                <label htmlFor="phone" className="label">Phone number</label>
                <input id="phone" name="phone" type="tel"
                       value={form.phone} onChange={handleChange}
                       className="input" placeholder="011-1234 5678" />
              </div>

              <div className="col-span-2">
                <label htmlFor="reg-email" className="label">Email address</label>
                <input id="reg-email" name="email" type="email" required autoComplete="email"
                       value={form.email} onChange={handleChange}
                       className="input" placeholder="you@example.com" />
              </div>

              {/* Password with Eye Toggle */}
              <div className="col-span-2">
                <label htmlFor="reg-password" className="label">Password</label>
                <PasswordInput
                  id="reg-password"
                  name="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                />

                {/* Password Strength Checklist */}
                <ul className="mt-2 space-y-1 text-xs">
                  {rules.map((rule) => (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-1.5 transition-colors duration-150 ${
                        rule.met ? 'text-emerald-600 font-medium' : 'text-gray-400'
                      }`}
                    >
                      <span className="font-bold text-xs">{rule.met ? '✓' : '•'}</span>
                      <span>{rule.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Confirm Password with Eye Toggle */}
              <div className="col-span-2">
                <label htmlFor="reg-confirm-password" className="label">Confirm password</label>
                <PasswordInput
                  id="reg-confirm-password"
                  name="confirmPassword"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  className={showMismatch ? 'input-error' : ''}
                />
                {showMismatch && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn">
                    Passwords do not match
                  </p>
                )}
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading || !isFormValid}
              className="btn-primary w-full btn-lg mt-2"
            >
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

