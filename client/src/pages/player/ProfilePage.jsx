import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getProfile, updateProfile } from '../../api/auth'
import Layout from '../../components/layout/Layout'
import Spinner from '../../components/ui/Spinner'
import ErrorMessage from '../../components/ui/ErrorMessage'
import {
  UserCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

const GENDERS      = ['Male', 'Female']
const SKILL_LEVELS = ['Beginner', 'Pro', 'Athlete']

export default function ProfilePage() {
  const { user, updateUser } = useAuth()

  // ── Personal details ─────────────────────────────────────────
  const [fullName, setFullName]     = useState('')
  const [gender, setGender]         = useState('')
  const [phone, setPhone]           = useState('')
  const [skillLevel, setSkillLevel] = useState('')

  // ── UI state ──────────────────────────────────────────────────
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  // Pre-fill from server (source of truth — localStorage may be stale after
  // fields are added that weren't included in the original login response)
  useEffect(() => {
    getProfile()
      .then((res) => {
        const d = res.data.data
        setFullName(d.fullName ?? '')
        setGender(d.gender ?? '')
        setPhone(d.phone ?? '')
        setSkillLevel(d.skillLevel ?? '')
      })
      .catch(() => {
        // Fall back to whatever AuthContext has in localStorage
        setFullName(user?.fullName ?? '')
        setGender(user?.gender ?? '')
        setPhone(user?.phone ?? '')
        setSkillLevel(user?.skillLevel ?? '')
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const res = await updateProfile({
        fullName:   fullName.trim(),
        gender,
        phone:      phone.trim(),
        skillLevel,
      })

      // Sync updated fields back into AuthContext + localStorage so the
      // navbar and any other consumer reflects the change immediately
      const d = res.data.data
      updateUser({
        fullName:    d.fullName,
        gender:      d.gender,
        phone:       d.phone,
        skillLevel:  d.skillLevel,
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="page-container max-w-2xl">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="page-title mb-1">My Profile</h1>
          <p className="text-sm text-gray-500">
            Keep your details up to date.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Account (email read-only) ── */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserCircleIcon className="h-5 w-5 text-primary-600" />
                <h2 className="font-semibold text-gray-900 text-sm">Account</h2>
              </div>
              <div>
                <label className="label">Email <span className="text-gray-400 font-normal">(cannot be changed)</span></label>
                <input className="input bg-gray-50 cursor-not-allowed text-gray-500"
                       value={user?.email ?? ''} readOnly />
              </div>
            </div>

            {/* ── Personal Details ── */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserCircleIcon className="h-5 w-5 text-primary-600" />
                <h2 className="font-semibold text-gray-900 text-sm">Personal Details</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="full-name">Full Name</label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ahmad Faris bin Abdullah"
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="gender">Gender</label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="select"
                    required
                  >
                    <option value="" disabled>Select gender</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="skill-level">Skill Level</label>
                  <select
                    id="skill-level"
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value)}
                    className="select"
                  >
                    <option value="" disabled>Select skill level</option>
                    {SKILL_LEVELS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 012-3456789"
                    className="input"
                  />
                </div>
              </div>
            </div>

            <ErrorMessage message={error} />

            {/* Success banner */}
            {success && (
              <div className="flex items-center gap-3 p-4 bg-primary-50 border border-primary-200
                              rounded-xl text-sm text-primary-800 animate-fadeIn">
                <CheckCircleIcon className="h-5 w-5 text-primary-600 shrink-0" />
                Profile saved successfully!
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end">
              <button
                id="save-profile-btn"
                type="submit"
                disabled={saving}
                className="btn-primary min-w-[140px]"
              >
                {saving ? <><Spinner size="sm" /> Saving…</> : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  )
}
