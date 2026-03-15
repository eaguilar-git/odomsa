import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { validateUser } from '../api'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await validateUser(email.trim().toLowerCase(), password)
      if (res.ok) {
        login({ email: email.trim().toLowerCase(), role: res.role, token: res.token, name: res.name })
      } else {
        setError(res.message || 'Credenciales incorrectas.')
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.brand}>
        <div style={styles.brandInner}>
          <div style={styles.tooth}>&#10022;</div>
          <h1 style={styles.brandTitle}>ODOMSA</h1>
          <p style={styles.brandSub}>Clinica Dental<br />Tomala, Lempira</p>
        </div>
      </div>
      <div style={styles.formPanel}>
        <div style={styles.formCard} className="fade-up">
          <h2 style={styles.formTitle}>Iniciar sesion</h2>
          <p style={styles.formDesc}>Acceso exclusivo para personal autorizado.</p>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Correo electronico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" required style={styles.input} autoComplete="email" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Contrasena</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;" required style={styles.input} autoComplete="current-password" />
            </div>
            {error && <div style={styles.error} className="fade-in">{error}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Entrar'}
            </button>
          </form>
          <p style={styles.hint}>Problemas de acceso? Contacta al administrador.</p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page:       { display:'flex', minHeight:'100vh' },
  brand:      { flex:'0 0 420px', background:'linear-gradient(160deg,#0D9488 0%,#065F46 100%)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  brandInner: { textAlign:'center', color:'#fff' },
  tooth:      { fontSize:'3rem', marginBottom:'1rem', display:'block', opacity:0.8 },
  brandTitle: { fontFamily:"'DM Serif Display',serif", fontSize:'3.5rem', fontWeight:400, letterSpacing:'0.08em', color:'#fff', lineHeight:1 },
  brandSub:   { marginTop:'1rem', fontSize:'1rem', opacity:0.75, lineHeight:1.6, fontWeight:300 },
  formPanel:  { flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', background:'var(--cream)' },
  formCard:   { width:'100%', maxWidth:'420px' },
  formTitle:  { fontSize:'2rem', marginBottom:'0.4rem', color:'var(--ink)' },
  formDesc:   { color:'var(--ink-muted)', fontSize:'0.9rem', marginBottom:'2.5rem' },
  form:       { display:'flex', flexDirection:'column', gap:'1.25rem' },
  field:      { display:'flex', flexDirection:'column', gap:'0.4rem' },
  label:      { fontSize:'0.8rem', fontWeight:500, color:'var(--ink-soft)', letterSpacing:'0.03em', textTransform:'uppercase' },
  input:      { padding:'0.75rem 1rem', border:'1.5px solid var(--border)', borderRadius:'var(--radius-sm)', background:'#fff', color:'var(--ink)', fontSize:'0.95rem', outline:'none' },
  error:      { padding:'0.75rem 1rem', background:'var(--red-light)', color:'var(--red)', borderRadius:'var(--radius-sm)', fontSize:'0.875rem' },
  btn:        { marginTop:'0.5rem', padding:'0.875rem', background:'var(--teal)', color:'#fff', borderRadius:'var(--radius-sm)', fontSize:'0.95rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' },
  hint:       { marginTop:'2rem', fontSize:'0.8rem', color:'var(--ink-muted)', textAlign:'center' },
}