import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../AuthContext'
import { findPatients, listPatientsPaged, getPatientDashboard, createPatient, createVisit } from '../api'
import { Section, Btn, Badge } from './ui'

// ── localStorage helpers ──────────────────────────────────────────────────────
const LIST_CACHE_PREFIX    = 'odomsa_patients_list_'
const PATIENT_CACHE_PREFIX = 'odomsa_patient_'

function readListCache(page) {
  try {
    const raw = localStorage.getItem(LIST_CACHE_PREFIX + page)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeListCache(page, data) {
  try { localStorage.setItem(LIST_CACHE_PREFIX + page, JSON.stringify(data)) } catch {}
}

function readPatientCache(identidad) {
  try {
    const raw = localStorage.getItem(PATIENT_CACHE_PREFIX + identidad)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writePatientCache(identidad, data) {
  try { localStorage.setItem(PATIENT_CACHE_PREFIX + identidad, JSON.stringify(data)) } catch {}
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Signature pad ─────────────────────────────────────────────────────────────
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const dirty     = useRef(false)

  const onChangeCb = useCallback(onChange, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.lineCap   = 'round'

    const pos = e => {
      const r = canvas.getBoundingClientRect()
      const src = e.touches ? e.touches[0] : e
      return { x: src.clientX - r.left, y: src.clientY - r.top }
    }
    const start = e => { e.preventDefault(); drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
    const move  = e => { e.preventDefault(); if (!drawing.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true }
    const end   = e => { e.preventDefault(); drawing.current = false; if (dirty.current) onChangeCb(canvas.toDataURL('image/png')) }

    canvas.addEventListener('mousedown',  start)
    canvas.addEventListener('mousemove',  move)
    canvas.addEventListener('mouseup',    end)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove',  move,  { passive: false })
    canvas.addEventListener('touchend',   end,   { passive: false })
    return () => {
      canvas.removeEventListener('mousedown',  start)
      canvas.removeEventListener('mousemove',  move)
      canvas.removeEventListener('mouseup',    end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove',  move)
      canvas.removeEventListener('touchend',   end)
    }
  }, [])

  const clear = () => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    dirty.current = false
    onChangeCb('')
  }

  return (
    <div>
      <canvas ref={canvasRef} width={500} height={150}
        style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'block', cursor: 'crosshair', touchAction: 'none', background: '#fff', maxWidth: '100%' }} />
      <button type="button" onClick={clear}
        style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--ink-muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.6rem', cursor: 'pointer' }}>
        Limpiar firma
      </button>
    </div>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

const FieldLabel = ({ children, required }) => (
  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '0.3rem' }}>
    {children}{required && <span style={{ color: 'var(--red)', marginLeft: '3px' }}>*</span>}
  </label>
)
const Input = ({ style: extra, ...p }) => (
  <input style={{ width: '100%', padding: '0.55rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', background: '#fff', color: 'var(--ink)', fontSize: '0.875rem', outline: 'none', ...extra }} {...p} />
)
const Select = ({ children, style: extra, ...p }) => (
  <select style={{ width: '100%', padding: '0.55rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', background: '#fff', color: 'var(--ink)', fontSize: '0.875rem', outline: 'none', ...extra }} {...p}>{children}</select>
)
const YesNoField = ({ label, name, value, onChange, detail, detailName, detailValue, detailOnChange, detailPlaceholder }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
    <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--ink)', paddingTop: '0.1rem', minWidth: '220px' }}>{label}</span>
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      {['si','no'].map(v => (
        <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(name, v)} />
          {v === 'si' ? 'Sí' : 'No'}
        </label>
      ))}
    </div>
    {detail && value === 'si' && (
      <Input style={{ width: '200px' }} placeholder={detailPlaceholder || 'Especifique…'} value={detailValue || ''} onChange={e => detailOnChange(detailName, e.target.value)} />
    )}
  </div>
)
const DataField = ({ label, value }) => !value ? null : (
  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '0.45rem 0', gap: '1rem' }}>
    <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', minWidth: '130px' }}>{label}</span>
    <span style={{ fontSize: '0.875rem', color: 'var(--ink)', textAlign: 'right' }}>{value}</span>
  </div>
)
const YesNoBadge = ({ label, value }) => {
  const v = String(value || '').toLowerCase()
  const yes = v === 'true' || v === 'si' || v === 'sí'
  const no  = v === 'false' || v === 'no'
  if (!yes && !no) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '0.45rem 0', alignItems: 'center' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{label}</span>
      <Badge color={yes ? 'red' : 'muted'}>{yes ? 'Sí' : 'No'}</Badge>
    </div>
  )
}

const EMPTY_PATIENT = {
  fecha_registro: today(), odontologo: '', nombre: '', identidad: '',
  fecha_nacimiento: '', estado_civil: '', nacionalidad: 'Honduras',
  celular: '', domicilio: '', profesion: '', motivo: '',
  enf_alguna: '', enfermedad_detalle: '',
  consume_medicamentos: '', medicamentos: '',
  alergico_medicamentos: '', alergias: '',
  sangrado_extraccion: '', diabetico: '', cardiaco: '',
  hipertension: '', operado: '', cirugia_detalle: '',
  respiratorio: '', fuma: '', alcohol: '', embarazo: '',
  otra_enfermedad: '',
  golpe_dientes: '', golpe_detalle: '',
  dificulta_hablar: '', dificulta_masticar: '', dificulta_abrir: '',
  sangrado_encias: '', sale_pus: '', supuracion_detalle: '',
  movilidad_dientes: '', movilidad_detalle: '',
  observaciones: '',
  firma_dibujo: '',
  firma: '',
}

const YES_NO_REQUIRED = ['enf_alguna','consume_medicamentos','alergico_medicamentos','sangrado_extraccion','diabetico','cardiaco','hipertension','operado','respiratorio','fuma','alcohol','embarazo','golpe_dientes','dificulta_hablar','dificulta_masticar','dificulta_abrir','sangrado_encias','sale_pus','movilidad_dientes']

export default function Patients() {
  const { isAdmin } = useAuth()
  const [view, setView]     = useState('list')
  const [status, setStatus] = useState('')

  // ✅ CHANGE 1 — initialize list from cache if available
  const [listData, setListData]       = useState(() => readListCache(1)?.rows || [])
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(() => readListCache(1)?.totalPages || 1)
  const [listLoading, setListLoading] = useState(false)

  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)

  // ✅ CHANGE 2 — initialize current patient from cache if we have one in state
  const [current, setCurrent]   = useState(null)
  const [loading, setLoading]   = useState(false)

  const [form, setForm]     = useState(EMPTY_PATIENT)
  const [saving, setSaving] = useState(false)

  const [visitForm, setVisitForm]     = useState({ fecha_visita: today(), odontologo: '', motivo: '', notas: '' })
  const [savingVisit, setSavingVisit] = useState(false)

  const [prevView, setPrevView] = useState('list')

  useEffect(() => { if (view === 'list') loadList(page) }, [view, page])

  const loadList = async (p) => {
    // ✅ CHANGE 3 — show cached list instantly, then fetch fresh in background
    const cached = readListCache(p)
    if (cached) {
      setListData(cached.rows)
      setTotalPages(cached.totalPages)
    } else {
      setListLoading(true)
    }
    setStatus('')

    try {
      const res  = await listPatientsPaged(p, 20)
      const rows = Array.isArray(res) ? res : (res.items || res.patients || res.rows || [])
      const total = res.totalPages || (res.total ? Math.ceil(res.total / 20) : 1) || 1
      setListData(rows)
      setTotalPages(total)
      // Save fresh data to cache
      writeListCache(p, { rows, totalPages: total })
    } catch (err) {
      // If we have cached data, keep showing it — just note the refresh failed
      if (!cached) setStatus('Error: ' + err.message)
      else setStatus('Mostrando datos guardados — sin conexión.')
    } finally {
      setListLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) return
    const q = query.trim().toLowerCase()
    setStatus('')

    // 1. Search all cached pages instantly (0ms)
    const cachedMatches = []
    let p = 1
    while (true) {
      const cached = readListCache(p)
      if (!cached) break
      const matches = cached.rows.filter(r =>
        (r.nombre    || '').toLowerCase().includes(q) ||
        (r.identidad || '').toLowerCase().includes(q) ||
        (r.celular   || '').toLowerCase().includes(q)
      )
      cachedMatches.push(...matches)
      if (p >= cached.totalPages) break
      p++
    }

    // Show cached results immediately if we found anything
    if (cachedMatches.length > 0) {
      setResults(cachedMatches)
      setStatus(`${cachedMatches.length} resultado(s) — verificando…`)
    } else {
      setSearching(true)
    }

    // 2. Always verify with GAS in background (catches patients on uncached pages)
    try {
      const res  = await findPatients(query.trim())
      const list = Array.isArray(res) ? res : (res.patients || [])

      if (list.length > 0) {
        setResults(list)
        setStatus(`${list.length} resultado(s) encontrado(s).`)
      } else if (cachedMatches.length === 0) {
        setResults([])
        setStatus('No se encontraron pacientes.')
      } else {
        // GAS confirmed — remove the "verificando" note
        setStatus(`${cachedMatches.length} resultado(s) encontrado(s).`)
      }
    } catch (err) {
      // GAS failed but we have cached results — keep showing them
      if (cachedMatches.length > 0) {
        setStatus(`${cachedMatches.length} resultado(s) — sin conexión, mostrando datos guardados.`)
      } else {
        setStatus('Error: ' + err.message)
      }
    } finally {
      setSearching(false)
    }
  }

  const openPatient = async (identidad, from) => {
    // ✅ CHANGE 4 — show cached patient instantly, fetch fresh in background
    const cached = readPatientCache(identidad)
    if (cached) {
      setCurrent(cached)
      setPrevView(from || view)
      setView('dashboard')
      setLoading(false)
    } else {
      setLoading(true)
    }
    setStatus('')

    try {
      const res = await getPatientDashboard(identidad)
      if (!res?.ok) { setStatus(res?.error || 'Error.'); return }
      setCurrent(res)
      setPrevView(from || view)
      setView('dashboard')
      // Save to cache
      writePatientCache(identidad, res)
    } catch (err) {
      if (!cached) setStatus('Error: ' + err.message)
      else setStatus('Mostrando datos guardados — sin conexión.')
    } finally {
      setLoading(false)
    }
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submitPatient = async () => {
    const required = ['fecha_registro','odontologo','nombre','identidad','fecha_nacimiento','estado_civil','nacionalidad','celular','domicilio','profesion','motivo']
    const missing  = required.filter(k => !String(form[k] || '').trim())
    if (missing.length) return setStatus('Faltan campos obligatorios: ' + missing.map(k => k.replace(/_/g,' ')).join(', '))
    const missingYN = YES_NO_REQUIRED.filter(k => !form[k])
    if (missingYN.length) return setStatus('Marcar Sí/No en: ' + missingYN.map(k => k.replace(/_/g,' ')).join(', '))
    if (!form.firma_dibujo) return setStatus('Debe capturar la firma del paciente/tutor en el recuadro.')
    if (!form.firma.trim()) return setStatus('Ingrese el nombre legible del firmante.')
    setSaving(true); setStatus('Guardando paciente…')
    try {
      const payload = { ...form }
      YES_NO_REQUIRED.forEach(k => { payload[k] = payload[k] === 'si' })
      payload.celular = payload.celular.replace(/\D+/g, '')
      const res = await createPatient(payload)
      if (!res?.ok) { setStatus(res?.error || 'Error al guardar.'); return }
      setStatus('Paciente creado ✓')
      // Invalidate page 1 cache so the new patient appears on next list load
      localStorage.removeItem(LIST_CACHE_PREFIX + '1')
      await openPatient(form.identidad, 'list')
      setForm(EMPTY_PATIENT)
    } catch (err) { setStatus('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  // ✅ CHANGE 5 — Optimistic UI for new visit
  const submitVisit = async () => {
    if (!visitForm.odontologo.trim()) return setStatus('Ingrese el odontólogo.')
    if (!visitForm.motivo.trim())     return setStatus('Ingrese el motivo.')

    // Snapshot before clearing
    const visitSnapshot = { ...visitForm }

    // Build optimistic visit record
    const optimisticVisit = {
      ...visitSnapshot,
      identidad: current.ficha.identidad,
      nombre:    current.ficha.nombre,
      _pending:  true,
    }

    // Add to dashboard immediately — navigate back to dashboard view
    const updatedCurrent = {
      ...current,
      visitas: [optimisticVisit, ...(current.visitas || [])],
    }
    setCurrent(updatedCurrent)
    setView('dashboard')
    setVisitForm({ fecha_visita: today(), odontologo: '', motivo: '', notas: '' })
    setStatus('Guardando visita…')
    setSavingVisit(true)

    try {
      const res = await createVisit({
        ...visitSnapshot,
        identidad: current.ficha.identidad,
        nombre:    current.ficha.nombre,
      })
      if (!res?.ok) throw new Error(res?.error || 'Error al guardar.')

      // Fetch confirmed data to replace optimistic record with real one
      const refreshed = await getPatientDashboard(current.ficha.identidad)
      if (refreshed?.ok) {
        setCurrent(refreshed)
        writePatientCache(current.ficha.identidad, refreshed)
      } else {
        // At least remove the pending flag
        setCurrent(prev => ({
          ...prev,
          visitas: prev.visitas.map(v => v._pending ? { ...v, _pending: false } : v)
        }))
      }
      setStatus('Visita guardada ✓')
    } catch (err) {
      // Rollback — remove the optimistic visit and re-open the form
      setCurrent(prev => ({
        ...prev,
        visitas: (prev.visitas || []).filter(v => !v._pending),
      }))
      setVisitForm(visitSnapshot)
      setView('newVisit')
      setStatus('Error al guardar. Datos restaurados — intenta de nuevo.')
    } finally {
      setSavingVisit(false)
    }
  }

  const TabBar = () => (
    <div style={tabBar}>
      {[['list','📋 Listar todos'],['search','🔍 Buscar'],['newPatient','➕ Nuevo paciente']].map(([id, lbl]) => (
        <button key={id} onClick={() => { setView(id); setStatus('') }}
          style={{ ...tabBtn, ...(view === id ? tabActive : {}) }}>
          {lbl}
        </button>
      ))}
    </div>
  )

  const PatientTable = ({ rows, emptyMsg }) => (
    <table style={table}>
      <thead><tr style={thead}>
        <th style={th}>Identidad</th><th style={th}>Nombre</th><th style={th}>Cel</th><th style={th}>Edad</th><th style={th}></th>
      </tr></thead>
      <tbody>
        {!rows.length
          ? <tr><td colSpan={5} style={{ ...td, color: 'var(--ink-muted)', padding: '1.5rem 0.75rem' }}>{emptyMsg}</td></tr>
          : rows.map(p => (
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
          ))
        }
      </tbody>
    </table>
  )

  // ── Views ─────────────────────────────────────────────────────────────────

  if (view === 'list') return (
    <div>
      <Header title="Pacientes" sub={`Página ${page} de ${totalPages}`}>
        <Btn variant="primary" onClick={() => { setView('newPatient'); setStatus('') }}>+ Nuevo paciente</Btn>
      </Header>
      <TabBar />
      {status && <p style={sts}>{status}</p>}
      <Section title="Todos los pacientes">
        {listLoading && !listData.length
          ? <p style={{ color: 'var(--ink-muted)' }}>Cargando…</p>
          : <PatientTable rows={listData} emptyMsg="Sin pacientes registrados." />
        }
        {listLoading && listData.length > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '0.5rem' }}>Actualizando…</p>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <Btn size="sm" variant="ghost" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>← Anterior</Btn>
            <span style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>Pág. {page} / {totalPages}</span>
            <Btn size="sm" variant="ghost" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>Siguiente →</Btn>
          </div>
        )}
      </Section>
    </div>
  )

  if (view === 'search') return (
    <div>
      <Header title="Buscar paciente" sub="Por nombre, identidad o teléfono" />
      <TabBar />
      <Section title="Búsqueda">
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <Input
            placeholder="Nombre, identidad o teléfono…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <Btn variant="primary" onClick={handleSearch} style={{ whiteSpace: 'nowrap' }}>
            {searching ? 'Buscando…' : 'Buscar'}
          </Btn>
        </div>
        {status && <p style={sts}>{status}</p>}
        {results.length > 0 && <PatientTable rows={results} emptyMsg="" />}
      </Section>
    </div>
  )

  if (view === 'newPatient') return (
    <div>
      <Header title="Nuevo paciente" sub="Historia clínica de ingreso inicial" />
      <TabBar />
      {status && <p style={{ ...sts, color: status.includes('✓') ? 'var(--teal)' : 'var(--red)' }}>{status}</p>}
      <Section title="Datos generales">
        <div style={g4}>
          <div><FieldLabel required>Fecha</FieldLabel><Input type="date" value={form.fecha_registro} onChange={e => setField('fecha_registro',e.target.value)} /></div>
          <div><FieldLabel required>Odontólogo</FieldLabel><Input value={form.odontologo} onChange={e => setField('odontologo',e.target.value)} placeholder="Nombre del odontólogo" /></div>
          <div style={{gridColumn:'span 2'}}><FieldLabel required>Nombre completo</FieldLabel><Input value={form.nombre} onChange={e => setField('nombre',e.target.value)} /></div>
          <div><FieldLabel required>Identidad</FieldLabel><Input value={form.identidad} onChange={e => setField('identidad',e.target.value)} /></div>
          <div><FieldLabel required>Fecha de nacimiento</FieldLabel><Input type="date" value={form.fecha_nacimiento} onChange={e => setField('fecha_nacimiento',e.target.value)} /></div>
          <div><FieldLabel required>Estado civil</FieldLabel>
            <Select value={form.estado_civil} onChange={e => setField('estado_civil',e.target.value)}>
              <option value="">— Seleccione —</option>
              <option>Casado/a</option><option>Soltero/a</option><option>Otro</option>
            </Select>
          </div>
          <div><FieldLabel required>Nacionalidad</FieldLabel><Input value={form.nacionalidad} onChange={e => setField('nacionalidad',e.target.value)} /></div>
          <div><FieldLabel required>Celular</FieldLabel><Input value={form.celular} onChange={e => setField('celular',e.target.value)} placeholder="9999-9999" /></div>
          <div style={{gridColumn:'span 2'}}><FieldLabel required>Domicilio</FieldLabel><Input value={form.domicilio} onChange={e => setField('domicilio',e.target.value)} /></div>
          <div><FieldLabel required>Profesión</FieldLabel><Input value={form.profesion} onChange={e => setField('profesion',e.target.value)} /></div>
          <div style={{gridColumn:'span 3'}}><FieldLabel required>Motivo de consulta</FieldLabel><Input value={form.motivo} onChange={e => setField('motivo',e.target.value)} /></div>
        </div>
      </Section>
      <Section title="Preguntas generales">
        <YesNoField label="¿Padece alguna enfermedad?" name="enf_alguna" value={form.enf_alguna} onChange={setField} detail detailName="enfermedad_detalle" detailValue={form.enfermedad_detalle} detailOnChange={setField} detailPlaceholder="¿Cuál?" />
        <YesNoField label="¿Consume medicamentos actualmente?" name="consume_medicamentos" value={form.consume_medicamentos} onChange={setField} detail detailName="medicamentos" detailValue={form.medicamentos} detailOnChange={setField} detailPlaceholder="¿Cuáles?" />
        <YesNoField label="¿Es alérgico a algún medicamento?" name="alergico_medicamentos" value={form.alergico_medicamentos} onChange={setField} detail detailName="alergias" detailValue={form.alergias} detailOnChange={setField} detailPlaceholder="¿Cuáles?" />
        <YesNoField label="¿Sangrado abundante después de extracción?" name="sangrado_extraccion" value={form.sangrado_extraccion} onChange={setField} />
        <YesNoField label="¿Es diabético?" name="diabetico" value={form.diabetico} onChange={setField} />
        <YesNoField label="¿Padece del corazón?" name="cardiaco" value={form.cardiaco} onChange={setField} />
        <YesNoField label="¿Tiene hipertensión?" name="hipertension" value={form.hipertension} onChange={setField} />
        <YesNoField label="¿Ha sido operado?" name="operado" value={form.operado} onChange={setField} detail detailName="cirugia_detalle" detailValue={form.cirugia_detalle} detailOnChange={setField} detailPlaceholder="¿De qué?" />
        <YesNoField label="¿Padece del sistema respiratorio?" name="respiratorio" value={form.respiratorio} onChange={setField} />
        <YesNoField label="¿Fuma?" name="fuma" value={form.fuma} onChange={setField} />
        <YesNoField label="¿Consume alcohol?" name="alcohol" value={form.alcohol} onChange={setField} />
        <YesNoField label="¿Está embarazada?" name="embarazo" value={form.embarazo} onChange={setField} />
        <div style={{marginTop:'0.75rem'}}><FieldLabel>Otra enfermedad o condición</FieldLabel><Input value={form.otra_enfermedad} onChange={e => setField('otra_enfermedad',e.target.value)} placeholder="Especifique si aplica" /></div>
      </Section>
      <Section title="Historia clínica odontológica">
        <YesNoField label="¿Ha sufrido golpes en los dientes?" name="golpe_dientes" value={form.golpe_dientes} onChange={setField} detail detailName="golpe_detalle" detailValue={form.golpe_detalle} detailOnChange={setField} detailPlaceholder="Describa" />
        <YesNoField label="¿Tiene dificultad para hablar?" name="dificulta_hablar" value={form.dificulta_hablar} onChange={setField} />
        <YesNoField label="¿Tiene dificultad para masticar?" name="dificulta_masticar" value={form.dificulta_masticar} onChange={setField} />
        <YesNoField label="¿Tiene dificultad para abrir la boca?" name="dificulta_abrir" value={form.dificulta_abrir} onChange={setField} />
        <YesNoField label="¿Le sangran las encías?" name="sangrado_encias" value={form.sangrado_encias} onChange={setField} />
        <YesNoField label="¿Le sale pus de las encías?" name="sale_pus" value={form.sale_pus} onChange={setField} detail detailName="supuracion_detalle" detailValue={form.supuracion_detalle} detailOnChange={setField} detailPlaceholder="¿Dónde?" />
        <YesNoField label="¿Tiene dientes con movilidad?" name="movilidad_dientes" value={form.movilidad_dientes} onChange={setField} detail detailName="movilidad_detalle" detailValue={form.movilidad_detalle} detailOnChange={setField} detailPlaceholder="¿Cuáles?" />
        <div style={{marginTop:'0.75rem'}}><FieldLabel>Observaciones adicionales</FieldLabel>
          <textarea rows={3} value={form.observaciones} onChange={e => setField('observaciones',e.target.value)} style={{width:'100%',padding:'0.55rem 0.8rem',border:'1.5px solid var(--border)',borderRadius:'var(--radius-sm)',background:'#fff',color:'var(--ink)',fontSize:'0.875rem',outline:'none',resize:'vertical'}} />
        </div>
      </Section>
      <Section title="Firma del paciente / tutor">
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '0.75rem' }}>
          Firme en el recuadro con el dedo o el mouse. Este consentimiento tiene carácter de declaración jurada.
        </p>
        <SignaturePad onChange={v => setField('firma_dibujo', v)} />
        <div style={{ marginTop: '1rem' }}>
          <FieldLabel required>Nombre legible del firmante</FieldLabel>
          <Input value={form.firma} onChange={e => setField('firma', e.target.value)} placeholder="Nombre completo del paciente o tutor" style={{ maxWidth: '400px' }} />
        </div>
      </Section>
      <div style={{display:'flex',gap:'1rem',marginBottom:'2rem'}}>
        <Btn variant="primary" onClick={submitPatient}>{saving ? 'Guardando…' : 'Guardar paciente'}</Btn>
        <Btn variant="ghost" onClick={() => { setForm(EMPTY_PATIENT); setStatus('') }}>Limpiar formulario</Btn>
      </div>
    </div>
  )

  if (view === 'dashboard' && current) {
    const { ficha, visitas = [] } = current
    return (
      <div>
        <Header title={ficha.nombre} sub="Expediente del paciente">
          <Btn variant="ghost" onClick={() => { setView(prevView); setStatus('') }}>← Volver</Btn>
          <Btn variant="primary" onClick={() => { setView('newVisit'); setStatus('') }}>+ Nueva visita</Btn>
        </Header>
        {status && <p style={{ ...sts, color: status.includes('✓') ? 'var(--teal)' : 'var(--ink-muted)' }}>{status}</p>}
        <Section title="Datos del paciente">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2rem'}}>
            <div>
              <DataField label="Identidad"      value={ficha.identidad} />
              <DataField label="Fecha nac."     value={ficha.fecha_nacimiento} />
              <DataField label="Edad"           value={ficha.edad_calc || ficha.edad_hist} />
              <DataField label="Estado civil"   value={ficha.estado_civil} />
              <DataField label="Nacionalidad"   value={ficha.nacionalidad} />
              <DataField label="Celular"        value={ficha.celular} />
              <DataField label="Domicilio"      value={ficha.domicilio} />
              <DataField label="Profesión"      value={ficha.profesion} />
              <DataField label="Motivo inicial" value={ficha.motivo} />
            </div>
            <div>
              <p style={{fontSize:'0.72rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--ink-soft)',marginBottom:'0.5rem'}}>Antecedentes médicos</p>
              <YesNoBadge label="Enfermedades" value={ficha.enf_alguna} />
              <YesNoBadge label="Medicamentos" value={ficha.consume_medicamentos ?? ficha.medicamentos} />
              <YesNoBadge label="Alergias"     value={ficha.alergico_medicamentos ?? ficha.alergias} />
              <YesNoBadge label="Diabético"    value={ficha.diabetico} />
              <YesNoBadge label="Cardíaco"     value={ficha.cardiaco} />
              <YesNoBadge label="Hipertensión" value={ficha.hipertension} />
              <YesNoBadge label="Embarazo"     value={ficha.embarazo} />
              <YesNoBadge label="Fuma"         value={ficha.fuma} />
              <YesNoBadge label="Alcohol"      value={ficha.alcohol} />
              {ficha.otra_enfermedad && <DataField label="Otra enf." value={ficha.otra_enfermedad} />}
              {ficha.observaciones   && <DataField label="Observaciones" value={ficha.observaciones} />}
            </div>
          </div>
        </Section>
        <Section title={`Historial de visitas (${visitas.length})`}>
          {!visitas.length
            ? <p style={{color:'var(--ink-muted)',fontSize:'0.875rem'}}>Sin visitas registradas.</p>
            : <table style={table}>
                <thead><tr style={thead}>
                  <th style={th}>Fecha</th><th style={th}>Odontólogo</th><th style={th}>Motivo</th><th style={th}>Notas</th>
                  {isAdmin && <th style={th}>Doc</th>}
                </tr></thead>
                <tbody>
                  {/* ✅ CHANGE 6 — pending visual on optimistic visit row */}
                  {visitas.map((v,i) => (
                    <tr key={i} style={{ ...trow, opacity: v._pending ? 0.55 : 1, transition: 'opacity 0.3s ease' }}>
                      <td style={td}>{v.fecha_visita}</td>
                      <td style={td}>
                        {v.odontologo}
                        {v._pending && <span style={pendingBadge}>⏳ guardando</span>}
                      </td>
                      <td style={td}>{v.motivo}</td>
                      <td style={{...td,color:'var(--ink-muted)',fontSize:'0.85rem'}}>{v.notas||'—'}</td>
                      {isAdmin && <td style={td}>{v.docUrl?<a href={v.docUrl} target="_blank" rel="noreferrer" style={{color:'var(--teal)'}}>Ver</a>:'—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </Section>
      </div>
    )
  }

  if (view === 'newVisit' && current) return (
    <div>
      <Header title="Nueva visita" sub={current.ficha.nombre}>
        <Btn variant="ghost" onClick={() => { setView('dashboard'); setStatus('') }}>← Cancelar</Btn>
      </Header>
      {status && <p style={sts}>{status}</p>}
      <Section title="Registrar visita">
        <div style={g4}>
          <div><FieldLabel required>Fecha</FieldLabel><Input type="date" value={visitForm.fecha_visita} onChange={e => setVisitForm({...visitForm,fecha_visita:e.target.value})} /></div>
          <div><FieldLabel required>Odontólogo</FieldLabel><Input value={visitForm.odontologo} onChange={e => setVisitForm({...visitForm,odontologo:e.target.value})} /></div>
          <div style={{gridColumn:'span 2'}}><FieldLabel required>Motivo</FieldLabel><Input value={visitForm.motivo} onChange={e => setVisitForm({...visitForm,motivo:e.target.value})} /></div>
          <div style={{gridColumn:'span 4'}}><FieldLabel>Notas</FieldLabel>
            <textarea rows={3} value={visitForm.notas} onChange={e => setVisitForm({...visitForm,notas:e.target.value})} style={{width:'100%',padding:'0.55rem 0.8rem',border:'1.5px solid var(--border)',borderRadius:'var(--radius-sm)',background:'#fff',color:'var(--ink)',fontSize:'0.875rem',outline:'none',resize:'vertical'}} />
          </div>
        </div>
        <div style={{marginTop:'1rem'}}>
          <Btn variant="primary" onClick={submitVisit}>{savingVisit ? 'Guardando…' : 'Guardar visita'}</Btn>
        </div>
      </Section>
    </div>
  )

  return null
}

// ── Shared sub-components ─────────────────────────────────────────────────────
const Header = ({ title, sub, children }) => (
  <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'1rem'}}>
    <div>
      <h1 style={{fontSize:'1.8rem',color:'var(--ink)'}}>{title}</h1>
      {sub && <p style={{fontSize:'0.875rem',color:'var(--ink-muted)',marginTop:'0.2rem'}}>{sub}</p>}
    </div>
    {children && <div style={{display:'flex',gap:'0.75rem'}}>{children}</div>}
  </div>
)

// ── Styles ────────────────────────────────────────────────────────────────────
const tabBar     = {display:'flex',gap:'0',marginBottom:'1.5rem',borderBottom:'2px solid var(--border)'}
const tabBtn     = {padding:'0.5rem 1.25rem',border:'none',borderBottom:'2px solid transparent',marginBottom:'-2px',background:'transparent',color:'var(--ink-muted)',fontSize:'0.875rem',fontWeight:500,cursor:'pointer',transition:'all 0.15s'}
const tabActive  = {color:'var(--teal)',borderBottomColor:'var(--teal)',fontWeight:600}
const sts        = {fontSize:'0.875rem',marginBottom:'1rem',color:'var(--ink-muted)'}
const table      = {width:'100%',borderCollapse:'collapse',fontSize:'0.875rem'}
const thead      = {borderBottom:'2px solid var(--border)'}
const th         = {padding:'0.6rem 0.75rem',textAlign:'left',fontWeight:600,fontSize:'0.75rem',textTransform:'uppercase',letterSpacing:'0.04em',color:'var(--ink-muted)'}
const trow       = {borderBottom:'1px solid var(--border)'}
const td         = {padding:'0.7rem 0.75rem',verticalAlign:'middle'}
const g4         = {display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1rem'}
const pendingBadge = {marginLeft:'0.5rem',fontSize:'0.7rem',color:'var(--ink-muted)',fontStyle:'italic'}