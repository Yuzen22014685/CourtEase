import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const TOKEN_KEY = 'ce_token'
const USER_KEY  = 'ce_user'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      const token  = localStorage.getItem(TOKEN_KEY)
      if (stored && token) {
        setUser(JSON.parse(stored))
      }
    } catch {
      // corrupted storage — clear it
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(TOKEN_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  const loginUser = useCallback((data) => {
    // data = { _id, fullName, email, role, token }
    const { token, ...userInfo } = data
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
    setUser(userInfo)
  }, [])

  /**
   * Patch specific fields onto the stored user (e.g. after a PATCH /api/auth/profile).
   * Does NOT change the JWT token — only updates the user object in memory + storage.
   */
  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const logoutUser = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const isAdmin  = user?.role === 'admin'
  const isPlayer = user?.role === 'player'

  return (
    <AuthContext.Provider value={{
      user, loading,
      loginUser, logoutUser, updateUser,
      isAdmin, isPlayer,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
