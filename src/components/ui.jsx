// Shared UI components

export function Section({ title, children, right }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeader}>
        <h2 style={sectionTitle}>{title}</h2>
        {right && <div>{right}</div>}
      </div>
      {children}
    </div>
  )
}

export function StatCard({ label, value, accent = 'var(--ink)', bg = '#fff', border = 'var(--border)' }) {
  return (
    <div style={{ ...statCard, background: bg, borderColor: border }}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: accent }}>{value}</div>
    </div>
  )
}

export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, style: extra }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: '0.4rem', borderRadius: 'var(--radius-sm)',
    fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1, transition: 'all 0.15s',
    border: '1.5px solid transparent',
    fontSize: size === 'sm' ? '0.8rem' : '0.875rem',
    padding: size === 'sm' ? '0.35rem 0.75rem' : '0.6rem 1.1rem',
  }
  const variants = {
    primary:  { background: 'var(--teal)', color: '#fff', borderColor: 'var(--teal)' },
    secondary:{ background: '#fff', color: 'var(--ink)', borderColor: 'var(--border)' },
    danger:   { background: 'var(--red-light)', color: 'var(--red)', borderColor: 'var(--red-light)' },
    ghost:    { background: 'transparent', color: 'var(--ink-soft)', borderColor: 'var(--border)' },
    success:  { background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...extra }}>
      {children}
    </button>
  )
}

export function Badge({ children, color = 'teal' }) {
  const colors = {
    teal:   { bg: 'var(--teal-light)',   text: 'var(--teal-dark)' },
    amber:  { bg: 'var(--amber-light)',  text: 'var(--amber)' },
    red:    { bg: 'var(--red-light)',    text: 'var(--red)' },
    green:  { bg: 'var(--green-light)',  text: 'var(--green)' },
    muted:  { bg: 'var(--cream-dark)',   text: 'var(--ink-muted)' },
  }
  const c = colors[color] || colors.teal
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.2rem 0.6rem', borderRadius: '99px',
      fontSize: '0.75rem', fontWeight: 600,
      background: c.bg, color: c.text,
    }}>
      {children}
    </span>
  )
}

export function StatusBar({ message, url, lastSync, onRefresh, onTogglePause, paused, catalogDirty, isAdmin }) {
  return (
    <div style={statusBar}>
      {message && <span style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{message}</span>}
      {url && <a href={url} target="_blank" rel="noopener" style={statusLink}>↗ Abrir hoja</a>}
      {lastSync && <span style={{ color: 'var(--ink-muted)', fontSize: '0.8rem' }}>Sync: {lastSync.toLocaleTimeString()}</span>}
      {catalogDirty && <Badge color="amber">Borrador catálogo</Badge>}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
        <Btn size="sm" variant="ghost" onClick={onRefresh}>↺ Actualizar</Btn>
        <Btn size="sm" variant="ghost" onClick={onTogglePause}>
          {paused ? '▶ Reanudar sync' : '⏸ Pausar sync'}
        </Btn>
      </div>
    </div>
  )
}

export function HNL(n) {
  return new Intl.NumberFormat('es-HN', {
    style: 'currency', currency: 'HNL', maximumFractionDigits: 0
  }).format(n || 0)
}

// ── Styles ───────────────────────────────────────────────────────────────────

const sectionStyle = {
  background: '#fff',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  padding: '1.5rem',
  marginBottom: '1.5rem',
  boxShadow: 'var(--shadow-sm)',
}
const sectionHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: '1.25rem',
}
const sectionTitle = {
  fontSize: '1.2rem', color: 'var(--ink)',
}
const statCard = {
  padding: '1.25rem 1.5rem',
  borderRadius: 'var(--radius)',
  border: '1px solid',
  boxShadow: 'var(--shadow-sm)',
}
const statLabel = {
  fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '0.5rem',
}
const statValue = {
  fontSize: '1.9rem', fontWeight: 700, lineHeight: 1,
}
const statusBar = {
  display: 'flex', alignItems: 'center', flexWrap: 'wrap',
  gap: '0.75rem', marginBottom: '1.5rem',
  padding: '0.75rem 1rem',
  background: '#fff', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)',
}
const statusLink = {
  color: 'var(--teal)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500,
}
