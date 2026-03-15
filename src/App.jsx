import { AuthProvider, useAuth } from './AuthContext'
import Login from './components/Login'
import ClinicSelect from './components/ClinicSelect'
import Dashboard from './components/Dashboard'

function AppInner() {
  const { session, clinicSelected } = useAuth()
  if (!session)        return <Login />
  if (!clinicSelected) return <ClinicSelect />
  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
