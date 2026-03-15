import { useAuth } from '../AuthContext'

const CLINICS = [
  {
    name: 'Tomala',
    subtitle: 'Lempira, Honduras',
    url: 'https://script.google.com/macros/s/AKfycbw6npDTpziujj1fo2q5GEwlJYZrznqIdfMb7ZFiSJ-2ZOXYSdQ2cyf7hufhE8lO4lAj/exec',
  },
  {
    name: 'San Sebastián',
    subtitle: 'Honduras',
    url: 'https://script.google.com/macros/s/AKfycbyKDANcv70fT_3NZHaKNhYPWL6NY8MXAVRjo6q2xzul84MqPbT32Tx7OSORxBl6-y_XtA/exec',
  },
]

export default function ClinicSelect() {
  const { session, selectClinic, logout } = useAuth()

  return (
    <div style={page}>
      <div style={brand}>
        <div style={tooth}>✦</div>
        <div style={brandTitle}>ODOMSA</div>
        <div style={brandSub}>Clínica Dental</div>
      </div>

      <div style={panel} className="fade-up">
        <h2 style={title}>Seleccionar clínica</h2>
        <p style={sub}>Bienvenido, {session?.name || session?.email}. ¿A cuál clínica deseas acceder?</p>

        <div style={cards}>
          {CLINICS.map(clinic => (
            <button
              key={clinic.name}
              style={card}
              onClick={() => selectClinic(clinic)}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { borderColor: 'var(--teal)', transform: 'translateY(-2px)' })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { borderColor: 'var(--border)', transform: 'translateY(0)' })}
            >
              <div style={cardIcon}>🦷</div>
              <div style={cardName}>{clinic.name}</div>
              <div style={cardSub}>{clinic.subtitle}</div>
            </button>
          ))}
        </div>

        <button onClick={logout} style={logoutBtn}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

const page       = { display:'flex', minHeight:'100vh', alignItems:'center', justifyContent:'center', background:'var(--cream)', flexDirection:'column', gap:'2rem', padding:'2rem' }
const brand      = { textAlign:'center' }
const tooth      = { fontSize:'2rem', color:'var(--teal)', marginBottom:'0.5rem' }
const brandTitle = { fontFamily:"'DM Serif Display',serif", fontSize:'2.5rem', color:'var(--ink)', letterSpacing:'0.08em' }
const brandSub   = { fontSize:'0.9rem', color:'var(--ink-muted)', marginTop:'0.25rem' }
const panel      = { background:'#fff', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', padding:'2.5rem', width:'100%', maxWidth:'480px', boxShadow:'var(--shadow)' }
const title      = { fontSize:'1.4rem', color:'var(--ink)', marginBottom:'0.4rem' }
const sub        = { fontSize:'0.875rem', color:'var(--ink-muted)', marginBottom:'2rem' }
const cards      = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem' }
const card       = { display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', padding:'2rem 1rem', borderRadius:'var(--radius)', border:'2px solid var(--border)', background:'#fff', cursor:'pointer', transition:'all 0.15s', width:'100%' }
const cardIcon   = { fontSize:'2rem' }
const cardName   = { fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', color:'var(--ink)' }
const cardSub    = { fontSize:'0.75rem', color:'var(--ink-muted)' }
const logoutBtn  = { width:'100%', padding:'0.6rem', background:'transparent', border:'1.5px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--ink-soft)', fontSize:'0.875rem', cursor:'pointer' }
