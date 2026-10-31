import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import { changePassword } from '../../api/auth'
import PasswordInput from '../ui/PasswordInput'
import PasswordChecklist, { checkPasswordValidity } from '../ui/PasswordChecklist'
import Spinner from '../ui/Spinner'
import ErrorMessage from '../ui/ErrorMessage'

export default function ChangePasswordCard() {
  const { loginUser, user } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  // Clear banners the moment the user edits any field so stale
  // messages never linger after the fields have changed.
  const clearBanners = () => {
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    // Do NOT clear success here — it would kill a valid banner on Enter / re-submit.
    // Banners are cleared the moment the user starts typing (clearBanners in onChange).

    // Client-side validation
    // If all fields are empty and a success banner is already showing
    // (e.g. Enter pressed after a successful change), do nothing.
    if (!currentPassword && !newPassword && !confirmPassword && success) {
      return
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.')
      return
    }
    if (!checkPasswordValidity(newPassword).isValid) {
      setError('New password does not meet the requirements.')
      return
    }
    if (confirmPassword !== newPassword) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }

    setSaving(true)
    try {
      const res = await changePassword({ currentPassword, newPassword })

      // Store the refreshed token + user exactly as LoginPage does after login:
      // loginUser({ token, ...userInfo }) writes to localStorage and updates
      // the AuthContext user state, keeping the session alive on this device
      // while every other device is signed out (their old tokens are rejected
      // by protect because passwordChangedAt was bumped on the server).
      loginUser(res.data.data)

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(res.data.message || 'Password changed successfully.')
      // Success banner stays until the user types in a field (clearBanners in onChange).
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5 mt-6">
      {/* Card header — same style as ProfilePage cards */}
      <div className="flex items-center gap-2 mb-4">
        <LockClosedIcon className="h-5 w-5 text-primary-600" />
        <h2 className="font-semibold text-gray-900 text-sm">Change password</h2>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Current password */}
        <div>
          <label className="label" htmlFor="current-password">Current password</label>
          <PasswordInput
            id="current-password"
            name="currentPassword"
            value={currentPassword}
            onChange={(e) => { clearBanners(); setCurrentPassword(e.target.value) }}
            autoComplete="current-password"
          />
          {/* Right-aligned link — same style as LoginPage's "Forgot password?" */}
          <div className="flex justify-end mt-1.5">
            <Link
              to={`/forgot-password${user?.email ? `?email=${encodeURIComponent(user.email)}` : ''}`}
              className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Forgot your current password?
            </Link>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="label" htmlFor="new-password">New password</label>
          <PasswordInput
            id="new-password"
            name="newPassword"
            value={newPassword}
            onChange={(e) => { clearBanners(); setNewPassword(e.target.value) }}
            autoComplete="new-password"
          />
          <PasswordChecklist password={newPassword} />
        </div>

        {/* Confirm new password */}
        <div>
          <label className="label" htmlFor="confirm-password">Confirm new password</label>
          <PasswordInput
            id="confirm-password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => { clearBanners(); setConfirmPassword(e.target.value) }}
            autoComplete="new-password"
          />
        </div>

        <ErrorMessage message={error} />

        {/* Success banner — same style as ProfilePage */}
        {success && (
          <div className="flex items-center gap-3 p-4 bg-primary-50 border border-primary-200
                          rounded-xl text-sm text-primary-800 animate-fadeIn">
            <CheckCircleIcon className="h-5 w-5 text-primary-600 shrink-0" />
            {success}
          </div>
        )}

        {/* Submit — same button classes as ProfilePage */}
        <div className="flex justify-end">
          <button
            id="change-password-btn"
            type="submit"
            disabled={saving}
            className="btn-primary min-w-[140px]"
          >
            {saving ? <><Spinner size="sm" /> Updating…</> : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  )
}
