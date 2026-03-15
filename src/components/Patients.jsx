import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { findPatients, getPatientDashboard, createVisit } from '../api'
import { Section, Btn, Badge, HNL } from './ui'

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10)

function Field({ label, value }) {
  if (!value) return null
  return (
    <div style={fieldRow}>
      <span style={fieldLabel}>{label}</span>
      <span style={fieldValue}>{value}</span>
    </div>
  )
}

function YesNo({ label, value }) {
  const v = String(value).toLowerCase()
  const yes = v === 'true' || v === 'si' || v === 'sí'
  const no  = v === 'false' || v === 'no'
  if (!yes && !no) return null
  return (
    <div style={fieldRow}>
      <span style={fieldLabel}>{label}</span>
      <Badge color={yes ? 'red' : 'muted'}>{yes ? 'Sí' : 'No'}</Badge>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Patients() {
  const { isAdmin } = useAuth()

  const [view, setView]           = useState('search')   // search | dashboard | newVisit
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [current, setCurrent]     = useState(null)       // full patient dashboard
  const [loading, setLoading]     = useState(false)
  const [status, setStatus]       = useState('')

  // Visit form
  const [visitForm, setVisitForm] = useState({ fecha_visita: today(), odontologo: '', motivo: '', notas: '' })
  const [saving, setSaving]       = useState(false)

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setStatus('')
    try {
      const res = await findPatients(query.trim())
      const list = Array.isArray(res) ? res : (res.patients || [])
      setResults(list)
      if (list.length === 0) setStatus('No se encontraron pacientes.')
    } catch (err) {
      setStatus('Error: ' + err.message)
    } finally {
      setSearching(false)
    }
  }

  // ── Open patient dashboard ─────────────────────────────────────────────────
  const openPatient = async (identidad) => {
    setLoading(true)
    setStatus('')
    try {
      const res = await getPatientDashboard(identidad)
      if (!res?.ok) { setStatus(res?.error || 'No se pudo cargar el paciente.'); return }
      setCurrent(res)
      setView('dashboard')
    } catch (err) {
      setStatus('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Submit visit ──────────────────────────────────────────────────────────
  const submitVisit = async () => {
    if (!visitForm.odontologo.trim()) return setStatus('Ingrese el nombre del odontólogo.')
    if (!visitForm.motivo.trim())     return setStatus('Ingrese el motivo de la visita.')
    setSaving(true)
    setStatus('Guardando visita…')
    try {
      const res = await createVisit({
        ...visitForm,
        identidad: current.ficha.identidad,
        nombre:    current.ficha.nombre,
      })
      if (!res?.ok) { setStatus(res?.error || 'No se pudo guardar.'); return }
      setStatus('Visita guardada ✓')
      // Refresh dashboard
      const refreshed = await getPatientDashboard(current.ficha.identidad)
      if (refreshed?.ok) setCurrent(refreshed)
      setView('dashboard')
      setVisitForm({ fecha_visita: today(), odontologo: '', motivo: '', notas: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Render: search view ───────────────────────────────────────────────────
  if (view === 'search') return (
    <div>
      <div style={pageHeader}>
        <div>
          <h1 style={pageTitle}>Pacientes</h1>
          <p style={pageSub}>Buscar por nombre, identidad o teléfono</p>
        </div>
      </div>

      <Section title="Buscar paciente">
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <input
            style={inputStyle}
            placeholder="Nombre, identidad o teléfono…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <Btn onClick={handleSearch} variant="primary" style={{ whiteSpace: 'nowrap' }}>
            {searching ? 'Buscando…' : 'Buscar'}
          </Btn>
        </div>

        {status && <p style={statusMsg}>{status}</p>}

        {results.length > 0 && (
          <table style={table}>
            <thead><tr style={thead}>
              <th style={th}>Identidad</th>
              <th style={th}>Nombre</th>
              <th style={th}>Cel</th>
              <th style={th}>Edad</th>
              <th style={th}></th>
            </tr></thead>
            <tbody>
              {results.map(p => (
                <tr key={p.identidad} style={trow}>
                  <td style={td}>{p.identidad}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{p.nombre}</td>
                  <td style={td}>{p.celular || '—'}</td>
                  <td style={td}>{p.edad || '—'}</td>
                  <td style={td}>
                    <Btn size="sm" variant="ghost" onClick={() => openPatient(p.identidad)}>
                      {loading ? '…' : 'Ver'}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )

  // ── Render: dashboard view ────────────────────────────────────────────────
  if (view === 'dashboard' && current) {
    const { ficha, visitas = [] } = current
    return (
      <div>
        <div style={pageHeader}>
          <div>
            <h1 style={pageTitle}>{ficha.nombre}</h1>
            <p style={pageSub}>Expediente del paciente</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Btn variant="ghost" onClick={() => { setView('search'); setStatus('') }}>← Volver</Btn>
            <Btn variant="primary" onClick={() => { setView('newVisit'); setStatus('') }}>+ Nueva visita</Btn>
          </div>
        </div>

        {status && <p style={statusMsg}>{status}</p>}

        {/* Patient card */}
        <Section title="Datos del paciente">
          <div style={cardGrid}>
            <div>
              <Field label="Identidad"    value={ficha.identidad} />
              <Field label="Fecha nac."   value={ficha.fecha_nacimiento} />
              <Field label="Edad"         value={ficha.edad_calc || ficha.edad_hist} />
              <Field label="Estado civil" value={ficha.estado_civil} />
              <Field label="Nacionalidad" value={ficha.nacionalidad} />
              <Field label="Celular"      value={ficha.celular} />
              <Field label="Domicilio"    value={ficha.domicilio} />
              <Field label="Profesión"    value={ficha.profesion} />
            </div>
            <div>
              <p style={sectionLabel}>Antecedentes médicos</p>
              <YesNo label="Enfermedades"      value={ficha.enf_alguna} />
              <YesNo label="Medicamentos"      value={ficha.consume_medicamentos ?? ficha.medicamentos} />
              <YesNo label="Alergias"          value={ficha.alergico_medicamentos ?? ficha.alergias} />
              <YesNo label="Diabético"         value={ficha.diabetico} />
              <YesNo label="Cardíaco"          value={ficha.cardiaco} />
              <YesNo label="Hipertensión"      value={ficha.hipertension} />
              <YesNo label="Embarazo"          value={ficha.embarazo} />
              <YesNo label="Fuma"              value={ficha.fuma} />
              <YesNo label="Alcohol"           value={ficha.alcohol} />
              {ficha.otra_enfermedad && <Field label="Otra enfermedad" value={ficha.otra_enfermedad} />}
              {ficha.observaciones    && <Field label="Observaciones"  value={ficha.observaciones} />}
            </div>
          </div>
        </Section>

        {/* Visit history */}
        <Section title={`Historial de visitas (${visitas.length})`}>
          {visitas.length === 0
            ? <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>Sin visitas registradas.</p>
            : (
              <table style={table}>
                <thead><tr style={thead}>
                  <th style={th}>Fecha</th>
                  <th style={th}>Odontólogo</th>
                  <th style={th}>Motivo</th>
                  <th style={th}>Notas</th>
                  {isAdmin && <th style={th}>Doc</th>}
                </tr></thead>
                <tbody>
                  {visitas.map((v, i) => (
                    <tr key={i} style={trow}>
                      <td style={td}>{v.fecha_visita}</td>
                      <td style={td}>{v.odontologo}</td>
                      <td style={td}>{v.motivo}</td>
                      <td style={{ ...td, color: 'var(--ink-muted)', fontSize: '0.85rem' }}>{v.notas || '—'}</td>
                      {isAdmin && <td style={td}>{v.docUrl ? <a href={v.docUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--teal)' }}>Ver</a> : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Section>
      </div>
    )
  }

  // ── Render: new visit form ────────────────────────────────────────────────
  if (view === 'newVisit' && current) return (
    <div>
      <div style={pageHeader}>
        <div>
          <h1 style={pageTitle}>Nueva visita</h1>
          <p style={pageSub}>{current.ficha.nombre}</p>
        </div>
        <Btn variant="ghost" onClick={() => { setView('dashboard'); setStatus('') }}>← Cancelar</Btn>
      </div>

      {status && <p style={statusMsg}>{status}</p>}

      <Section title="Registrar visita">
        <div style={formGrid}>
          <div>
            <FieldLabel>Fecha de visita</FieldLabel>
            <input type="date" style={inputStyle} value={visitForm.fecha_visita}
              onChange={e => setVisitForm({ ...visitForm, fecha_visita: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Odontólogo</FieldLabel>
            <input style={inputStyle} placeholder="Nombre del odontólogo" value={visitForm.odontologo}
              onChange={e => setVisitForm({ ...visitForm, odontologo: e.target.value })} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <FieldLabel>Motivo de la visita</FieldLabel>
            <input style={inputStyle} placeholder="Descripción del tratamiento o consulta" value={visitForm.motivo}
              onChange={e => setVisitForm({ ...visitForm, motivo: e.target.value })} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <FieldLabel>Notas</FieldLabel>
            <textarea rows={3} style={{ ...inputStyle, resize: 'vertical', height: 'auto' }} value={visitForm.notas}
              onChange={e => setVisitForm({ ...visitForm, notas: e.target.value })} />
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Btn variant="primary" onClick={submitVisit}>
            {saving ? 'Guardando…' : 'Guardar visita'}
          </Btn>
        </div>
      </Section>
    </div>
  )

  return null
}

// ── Mini components ───────────────────────────────────────────────────────────
const FieldLabel = ({ children }) => (
  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '0.35rem' }}>
    {children}
  </label>
)

// ── Styles ────────────────────────────────────────────────────────────────────
const inputStyle  = { width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', background: '#fff', color: 'var(--ink)', fontSize: '0.9rem', outline: 'none' }
const pageHeader  = { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }
const pageTitle   = { fontSize: '1.8rem', color: 'var(--ink)' }
const pageSub     = { fontSize: '0.875rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }
const statusMsg   = { fontSize: '0.875rem', color: 'var(--ink-muted)', marginBottom: '1rem' }
const table       = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }
const thead       = { borderBottom: '2px solid var(--border)' }
const th          = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-muted)' }
const trow        = { borderBottom: '1px solid var(--border)' }
const td          = { padding: '0.7rem 0.75rem', verticalAlign: 'middle' }
const cardGrid    = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }
const fieldRow    = { display: 'flex', gap: '0.75rem', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '0.5rem 0', alignItems: 'center' }
const fieldLabel  = { fontSize: '0.8rem', color: 'var(--ink-muted)', minWidth: '130px' }
const fieldValue  = { fontSize: '0.875rem', color: 'var(--ink)', textAlign: 'right' }
const sectionLabel = { fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)', marginBottom: '0.5rem' }
const formGrid    = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }
