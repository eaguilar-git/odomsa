import { useState, useEffect } from 'react'
import { useAuth } from '../AuthContext'
import { findPatients, listPatientsPaged, getPatientDashboard, createPatient, createVisit } from '../api'
import { Section, Btn, Badge } from './ui'

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
}

const YES_NO_REQUIRED = ['enf_alguna','consume_medicamentos','alergico_medicamentos','sangrado_extraccion','diabetico','cardiaco','hipertension','operado','respiratorio','fuma','alcohol','embarazo','golpe_dientes','dificulta_hablar','dificulta_masticar','dificulta_abrir','sangrado_encias','sale_pus','movilidad_dientes']

export default function Patients() {
  const { isAdmin } = useAuth()
  const [view, setView]     = useState('list')
  const [status, setStatus] = useState('')

  const [listData, setListData]       = useState([])
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(1)
  const [listLoading, setListLoading] = useState(false)

  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)

  const [current, setCurrent]   = useState(null)
  const [loading, setLoading]   = useState(false)

  const [form, setForm]   = useState(EMPTY_PATIENT)
  const [saving, setSaving] = useState(false)

  const [visitForm, setVisitForm]     = useState({ fecha_visita: today(), odontologo: '', motivo: '', notas: '' })
  const [savingVisit, setSavingVisit] = useState(false)

  const [prevView, setPrevView] = useState('list')

  useEffect(() => { if (view === 'list') loadList(page) }, [view, page])

  const loadList = async (p) => {
    setListLoading(true); setStatus('')
    try {
      const res = await listPatientsPaged(p, 20)
      const rows = Array.isArray(res) ? res : (res.patients || res.rows || [])
      const total = res.totalPages || Math.ceil((res.totalCount || rows.length) / 20) || 1
      setListData(rows); setTotalPages(total)
    } catch (err) { setStatus('Error: ' + err.message) }
    finally { setListLoading(false) }
  }

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true); setStatus('')
    try {
      const res = await findPatients(query.trim())
      const list = Array.isArray(res) ? res : (res.patients || [])
      setResults(list)
      if (!list.length) setStatus('No se encontraron pacientes.')
    } catch (err) { setStatus('Error: ' + err.message) }
    finally { setSearching(false) }
  }

  const openPatient = async (identidad, from) => {
    setLoading(true); setStatus('')
    try {
      const res = await getPatientDashboard(identidad)
      if (!res?.ok) { setStatus(res?.error || 'Error.'); return }
      setCurrent(res); setPrevView(from || view); setView('dashboard')
    } catch (err) { setStatus('Error: ' + err.message) }
    finally { setLoading(false) }
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submitPatient = async () => {
    const required = ['fecha_registro','odontologo','nombre','identidad','fecha_nacimiento','estado_civil','nacionalidad','celular','domicilio','profesion','motivo']
    const missing = required.filter(k => !String(form[k] || '').trim())
    if (missing.length) return setStatus('Faltan campos obligatorios: ' + missing.map(k => k.replace(/_/g,' ')).join(', '))
    const missingYN = YES_NO_REQUIRED.filter(k => !form[k])
    if (missingYN.length) return setStatus('Marcar Sí/No en: ' + missingYN.map(k => k.replace(/_/g,' ')).join(', '))
    setSaving(true); setStatus('Guardando paciente…')
    try {
      const payload = { ...form }
      YES_NO_REQUIRED.forEach(k => { payload[k] = payload[k] === 'si' })
      payload.celular = payload.celular.replace(/\D+/g, '')
      const res = await createPatient(payload)
      if (!res?.ok) { setStatus(res?.error || 'Error al guardar.'); return }
      setStatus('Paciente creado ✓')
      await openPatient(form.identidad, 'list')
      setForm(EMPTY_PATIENT)
    } catch (err) { setStatus('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  const submitVisit = async () => {
    if (!visitForm.odontologo.trim()) return setStatus('Ingrese el odontólogo.')
    if (!visitForm.motivo.trim())     return setStatus('Ingrese el motivo.')
    setSavingVisit(true); setStatus('Guardando…')
    try {
      const res = await createVisit({ ...visitForm, identidad: current.ficha.identidad, nombre: current.ficha.nombre })
      if (!res?.ok) { setStatus(res?.error || 'Error.'); return }
      const refreshed = await getPatientDashboard(current.ficha.identidad)
      if (refreshed?.ok) setCurrent(refreshed)
      setStatus('Visita guardada ✓'); setView('dashboard')
      setVisitForm({ fecha_visita: today(), odontologo: '', motivo: '', notas: '' })
    } catch (err) { setStatus('Error: ' + err.message) }
    finally { setSavingVisit(false) }
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
              <td style={td}><Btn size="sm" variant="ghost" onClick={() => openPatient(p.identidad)}>{loading ? '…' : 'Ver'}</Btn></td>
            </tr>
          ))}
      </tbody>
    </table>
  )

  if (view === 'list') return (
    <div>
      <Header title="Pacientes" sub={`Página ${page} de ${totalPages}`}><Btn variant="primary" onClick={() => { setView('newPatient'); setStatus('') }}>+ Nuevo paciente</Btn></Header>
      <TabBar />
      {status && <p style={sts}>{status}</p>}
      <Section title="Todos los pacientes">
        {listLoading ? <p style={{ color: 'var(--ink-muted)' }}>Cargando…</p> : <PatientTable rows={listData} emptyMsg="Sin pacientes registrados." />}
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
          <Input placeholder="Nombre, identidad o teléfono…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSearch()} />
          <Btn variant="primary" onClick={handleSearch} style={{ whiteSpace: 'nowrap' }}>{searching ? 'Buscando…' : 'Buscar'}</Btn>
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
      <div style={{display:'flex',gap:'1rem',marginBottom:'2rem'}}>
        <Btn variant="primary" onClick={submitPatient}>{saving ? 'Guardando…' : 'Guardar paciente'}</Btn>
        <Btn variant="ghost" onClick={() => { setForm(EMPTY_PATIENT); setStatus('') }}>Limpiar</Btn>
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
                  {visitas.map((v,i) => (
                    <tr key={i} style={trow}>
                      <td style={td}>{v.fecha_visita}</td>
                      <td style={td}>{v.odontologo}</td>
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
        <div style={{marginTop:'1rem'}}><Btn variant="primary" onClick={submitVisit}>{savingVisit?'Guardando…':'Guardar visita'}</Btn></div>
      </Section>
    </div>
  )

  return null
}

const Header = ({ title, sub, children }) => (
  <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'1rem'}}>
    <div>
      <h1 style={{fontSize:'1.8rem',color:'var(--ink)'}}>{title}</h1>
      {sub && <p style={{fontSize:'0.875rem',color:'var(--ink-muted)',marginTop:'0.2rem'}}>{sub}</p>}
    </div>
    {children && <div style={{display:'flex',gap:'0.75rem'}}>{children}</div>}
  </div>
)

const tabBar   = {display:'flex',gap:'0',marginBottom:'1.5rem',borderBottom:'2px solid var(--border)'}
const tabBtn   = {padding:'0.5rem 1.25rem',border:'none',borderBottom:'2px solid transparent',marginBottom:'-2px',background:'transparent',color:'var(--ink-muted)',fontSize:'0.875rem',fontWeight:500,cursor:'pointer',transition:'all 0.15s'}
const tabActive = {color:'var(--teal)',borderBottomColor:'var(--teal)',fontWeight:600}
const sts      = {fontSize:'0.875rem',marginBottom:'1rem',color:'var(--ink-muted)'}
const table    = {width:'100%',borderCollapse:'collapse',fontSize:'0.875rem'}
const thead    = {borderBottom:'2px solid var(--border)'}
const th       = {padding:'0.6rem 0.75rem',textAlign:'left',fontWeight:600,fontSize:'0.75rem',textTransform:'uppercase',letterSpacing:'0.04em',color:'var(--ink-muted)'}
const trow     = {borderBottom:'1px solid var(--border)'}
const td       = {padding:'0.7rem 0.75rem',verticalAlign:'middle'}
const g4       = {display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1rem'}
