import { AuthProvider, useAuth } from './AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

function AppInner() {
  const { session } = useAuth()
  return session ? <Dashboard /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}