import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)
const SESSION_KEY = 'odomsa_session'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  const login = (userData) => {
    const s = { ...userData, clinicUrl: null, clinicName: null, patientsUrl: null }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
  }

  const selectClinic = (clinic) => {
    // clinic: { name, url, patientsUrl }
    const s = { ...session, clinicUrl: clinic.url, clinicName: clinic.name, patientsUrl: clinic.patientsUrl }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  const isAdmin        = session?.role === 'admin'
  const clinicSelected = !!session?.clinicUrl

  return (
    <AuthContext.Provider value={{ session, login, selectClinic, logout, isAdmin, clinicSelected }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
