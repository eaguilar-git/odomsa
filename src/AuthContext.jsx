import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)
const SESSION_KEY = 'odomsa_session'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { const r = sessionStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  })

  const login = (userData) => {
    sessionStorage.setItem('odomsa_token', userData.token)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    setSession(userData)
  }

  const logout = () => {
    sessionStorage.removeItem('odomsa_token')
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  const isAdmin = session?.role === 'admin'
  const isStaff = session?.role === 'staff' || isAdmin

  return (
    <AuthContext.Provider value={{ session, login, logout, isAdmin, isStaff }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }