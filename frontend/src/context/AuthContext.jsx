import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import * as authService from '../services/auth'
import { unwrap } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('smarteval_user')
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('smarteval_token') || null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user && !token) logout()
  }, [])

  const persist = useCallback((newUser, newToken) => {
    setUser(newUser)
    setToken(newToken)
    if (newUser) localStorage.setItem('smarteval_user', JSON.stringify(newUser))
    else localStorage.removeItem('smarteval_user')
    if (newToken) localStorage.setItem('smarteval_token', newToken)
    else localStorage.removeItem('smarteval_token')
  }, [])

  const register = useCallback(async (payload) => {
    setLoading(true)
    try {
      const res = await authService.register(payload)
      const data = unwrap(res)
      persist(data.user, data.token)
      return data
    } finally {
      setLoading(false)
    }
  }, [persist])

  const login = useCallback(async (payload) => {
    setLoading(true)
    try {
      const res = await authService.login(payload)
      const data = unwrap(res)
      persist(data.user, data.token)
      return data
    } finally {
      setLoading(false)
    }
  }, [persist])

  const logout = useCallback(async () => {
    try { await authService.logout() } catch { /* ignore */ }
    persist(null, null)
  }, [persist])

  const refreshProfile = useCallback(async () => {
    try {
      const res = await authService.getProfile()
      const u = unwrap(res)
      setUser(u)
      localStorage.setItem('smarteval_user', JSON.stringify(u))
    } catch { /* ignore */ }
  }, [])

  const value = useMemo(() => ({
    user, token, loading, authenticated: !!user && !!token,
    register, login, logout, refreshProfile,
  }), [user, token, loading, register, login, logout, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
