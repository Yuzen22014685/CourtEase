import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { register } from '../../api/auth'
import { checkProfileComplete } from '../../utils/format'
import ErrorMessage from '../../components/ui/ErrorMessage'
import Spinner from '../../components/ui/Spinner'

const INITIAL = {
  fullName: '',
  gender: '',
  phone: '',
  address: '',
  email: '',
  password: '',
  skillLevel: 'Beginner',
}

export default function RegisterPage() {
  const navigate  = useNavigate()
  const { loginUser } = useAuth()

  const [form, setForm]     = useState(INITIAL)
  const [error, setError]   = useState('')
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
      const res = await register(form)
      const data = res.data.data
      loginUser(data)
      if (!checkProfileComplete(data)) {
        // Profile incomplete — redirect to profile page before venue browsing
        navigate('/profile', { replace: true })
      } else {
        navigate('/venues', { replace: true })
      }
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

              <div className="col-span-2">
                <label htmlFor="reg-password" className="label">Password</label>
                <input id="reg-password" name="password" type="password" required autoComplete="new-password"
                       value={form.password} onChange={handleChange}
                       className="input" placeholder="Min. 8 characters" />
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading || !form.fullName || !form.email || !form.password || !form.gender}
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
