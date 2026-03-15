import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../AuthContext'
import { getDayData, addIncome, updateIncome, deleteIncome, addExpense, updateExpense, deleteExpense, saveCatalog, consolidateDay } from '../api'
import { Section, StatCard, Btn, Badge, StatusBar, HNL } from './ui'

const todayISO = () => new Date().toISOString().slice(0, 10)
const makeId   = () => Math.random().toString(36).slice(2, 9)

const DEFAULT_CATALOG = [
  { key: 'limpieza',        name: 'Limpieza',                            price: 600  },
  { key: 'limpieza_perio',  name: 'Limpieza con Periodontitis',          price: 750  },
  { key: 'tapon_peq',       name: 'Tapón Pequeño',                       price: 650  },
  { key: 'tapon_med',       name: 'Tapón Mediano',                       price: 720  },
  { key: 'tapon_grande',    name: 'Tapón Grande',                        price: 800  },
  { key: 'guarda_oc',       name: 'Guarda Oclusal',                      price: 800  },
  { key: 'eval_norm',       name: 'Evaluación Normal',                   price: 250  },
  { key: 'eval_rx',         name: 'Evaluación con Radiografía',          price: 300  },
  { key: 'rx',              name: 'Radiografía',                         price: 190  },
  { key: 'ex_simple',       name: 'Extracción Simple',                   price: 400  },
  { key: 'ex_cirugia',      name: 'Extracción con Cirugía',              price: 600  },
  { key: 'cordal_cx',       name: 'Cordal con Cirugía',                  price: 2400 },
  { key: 'cordal_simple',   name: 'Cordal Simple',                       price: 950  },
]

const PAYMENT_TYPES   = ['Efectivo', 'Transferencia Bancaria', 'Tarjeta']
const EXPENSE_REF     = ['Agua botellón', 'Envíos de prótesis', 'Limpieza', 'Pago de prótesis', 'Descuento']

export default function Dashboard() {
  const { session, logout, isAdmin } = useAuth()

  // ── State ─────────────────────────────────────────────────────────────────
  const [date, setDate]             = useState(todayISO())
  const [data, setData]             = useState({ incomes: [], expenses: [], catalog: DEFAULT_CATALOG })
  const [status, setStatus]         = useState('')
  const [sheetUrl, setSheetUrl]     = useState('')
  const [lastSync, setLastSync]     = useState(null)
  const [paused, setPaused]         = useState(false)
  const [catalogDirty, setCatalogDirty] = useState(false)
  const [loading, setLoading]       = useState(false)
  const syncTimer = useRef(null)

  // Income form
  const [incomeForm, setIncomeForm] = useState({ patientName: '', services: [], date: todayISO(), payment: PAYMENT_TYPES[0], notes: '', totalHNL: 0 })
  const [serviceAdder, setServiceAdder] = useState({ key: '', qty: 1, price: '', customName: '' })
  const [editingIncomeId, setEditingIncomeId]             = useState(null)
  const [editingIncomeOriginalDate, setEditingIncomeOriginalDate] = useState(null)

  // Expense form
  const [expenseForm, setExpenseForm] = useState({ date: todayISO(), concept: '', amount: '', notes: '' })
  const [editingExpenseId, setEditingExpenseId]             = useState(null)
  const [editingExpenseOriginalDate, setEditingExpenseOriginalDate] = useState(null)

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchDay = async (d = date) => {
    if (paused || catalogDirty) return
    setStatus('Cargando datos…')
    setLoading(true)
    try {
      const res = await getDayData(d)
      if (!res?.ok) { setStatus('No se pudo leer el día.'); return }
      const state = {
        incomes:  (res.incomes  || []).map(x => ({ ...x, id: x.id || makeId() })),
        expenses: (res.expenses || []).map(e => ({ ...e, id: e.id || makeId() })),
        catalog:  (res.catalog  && res.catalog.length) ? res.catalog : DEFAULT_CATALOG,
      }
      setData(state)
      setSheetUrl(res.url || '')
      setLastSync(new Date())
      setStatus('Datos actualizados ✔')
    } catch (err) {
      setStatus('Error: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDay(date) }, [date])

  useEffect(() => {
    if (paused || catalogDirty) { clearInterval(syncTimer.current); syncTimer.current = null; return }
    const start = () => { if (!syncTimer.current) syncTimer.current = setInterval(() => fetchDay(date), 20000) }
    const stop  = () => { clearInterval(syncTimer.current); syncTimer.current = null }
    const onVis = () => document.visibilityState === 'visible' ? start() : stop()
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { document.removeEventListener('visibilitychange', onVis); stop() }
  }, [date, paused, catalogDirty])

  // ── Date change ───────────────────────────────────────────────────────────
  const handleDateChange = (newDate) => {
    if (newDate === date) return
    if (!confirm('Cambiar fecha limpiará lo visible y cargará los datos guardados. ¿Continuar?')) return
    setDate(newDate)
    setStatus('')
    setSheetUrl('')
    clearForms()
    setData({ incomes: [], expenses: [], catalog: DEFAULT_CATALOG })
  }

  const clearForms = () => {
    setEditingIncomeId(null); setEditingIncomeOriginalDate(null)
    setEditingExpenseId(null); setEditingExpenseOriginalDate(null)
    setIncomeForm({ patientName: '', services: [], date, payment: PAYMENT_TYPES[0], notes: '', totalHNL: 0 })
    setServiceAdder({ key: '', qty: 1, price: '', customName: '' })
    setExpenseForm({ date, concept: '', amount: '', notes: '' })
  }

  // ── Income helpers ────────────────────────────────────────────────────────
  const incomeTotalLocal = (ing) => ing.services.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0)
  const rowTotal         = (ing) => (typeof ing.totalHNL === 'number' ? ing.totalHNL : incomeTotalLocal(ing))

  const addServiceToIncome = () => {
    let name, price
    if (serviceAdder.key === '__custom__') {
      name  = serviceAdder.customName?.trim() || 'Servicio personalizado'
      price = Number(serviceAdder.price) || 0
    } else {
      const found = data.catalog.find(c => c.key === serviceAdder.key)
      if (!found) return alert('Elija un servicio')
      name = found.name; price = Number(found.price) || 0
    }
    setIncomeForm(f => ({ ...f, services: [...f.services, { id: makeId(), name, price, qty: Number(serviceAdder.qty) || 1 }] }))
    setServiceAdder({ key: '', qty: 1, price: '', customName: '' })
  }

  const submitIncome = async () => {
    if (!incomeForm.patientName?.trim()) return alert('Ingrese el nombre del paciente')
    if (!incomeForm.services.length && !editingIncomeId) return alert('Agregue al menos un servicio')
    const servicesText = incomeForm.services.map(s => `${s.name} x${s.qty} (${s.price})`).join('; ')
    const computedTotal = incomeForm.services.length ? incomeTotalLocal(incomeForm) : Number(incomeForm.totalHNL || 0)
    const ingresoId = editingIncomeId || makeId()
    const payload = { date: incomeForm.date, patientName: incomeForm.patientName, servicesText, payment: incomeForm.payment, notes: incomeForm.notes || '', totalHNL: computedTotal, ingresoId, previousDate: editingIncomeOriginalDate || incomeForm.date }
    setStatus(editingIncomeId ? 'Actualizando ingreso…' : 'Guardando ingreso…')
    try {
      const res = editingIncomeId ? await updateIncome(payload) : await addIncome(payload)
      setStatus(editingIncomeId ? (res.moved ? 'Ingreso movido ✔' : 'Ingreso actualizado ✔') : 'Ingreso guardado ✔')
      if (res.url) setSheetUrl(res.url)
      fetchDay(incomeForm.date)
    } catch (err) { setStatus('Error: ' + err.message) }
    setEditingIncomeId(null); setEditingIncomeOriginalDate(null)
    setIncomeForm({ patientName: '', services: [], date, payment: PAYMENT_TYPES[0], notes: '', totalHNL: 0 })
  }

  const editIncome = (id) => {
    const row = data.incomes.find(x => x.id === id)
    if (!row) return
    setIncomeForm({ patientName: row.patientName, services: row.services || [], date: row.date, payment: row.payment, notes: row.notes || '', totalHNL: Number(row.totalHNL) || 0 })
    setEditingIncomeId(id); setEditingIncomeOriginalDate(row.date)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteIncome = async (id) => {
    const row = data.incomes.find(x => x.id === id)
    if (!row || !confirm('¿Eliminar este ingreso?')) return
    setStatus('Eliminando…')
    try {
      await deleteIncome({ date: row.date, ingresoId: id, previousDate: row.date })
      setStatus('Ingreso eliminado ✔')
      fetchDay(date)
    } catch (err) { setStatus('Error: ' + err.message) }
  }

  // ── Expense helpers ───────────────────────────────────────────────────────
  const submitExpense = async () => {
    const amt = Number(expenseForm.amount)
    if (!expenseForm.concept?.trim()) return alert('Ingrese el concepto')
    if (!(amt > 0)) return alert('Ingrese un monto válido')
    const egresoId = editingExpenseId || makeId()
    const payload = { date: expenseForm.date, concept: expenseForm.concept, amount: amt, notes: expenseForm.notes || '', egresoId, previousDate: editingExpenseOriginalDate || expenseForm.date }
    setStatus(editingExpenseId ? 'Actualizando egreso…' : 'Guardando egreso…')
    try {
      const res = editingExpenseId ? await updateExpense(payload) : await addExpense(payload)
      setStatus(editingExpenseId ? (res.moved ? 'Egreso movido ✔' : 'Egreso actualizado ✔') : 'Egreso guardado ✔')
      if (res.url) setSheetUrl(res.url)
      fetchDay(expenseForm.date)
    } catch (err) { setStatus('Error: ' + err.message) }
    setEditingExpenseId(null); setEditingExpenseOriginalDate(null)
    setExpenseForm({ date, concept: '', amount: '', notes: '' })
  }

  const editExpense = (id) => {
    const row = data.expenses.find(x => x.id === id)
    if (!row) return
    setExpenseForm({ date: row.date, concept: row.concept, amount: row.amount, notes: row.notes || '' })
    setEditingExpenseId(id); setEditingExpenseOriginalDate(row.date)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteExpense = async (id) => {
    const row = data.expenses.find(x => x.id === id)
    if (!row || !confirm('¿Eliminar este egreso?')) return
    setStatus('Eliminando…')
    try {
      await deleteExpense({ date: row.date, egresoId: id, previousDate: row.date })
      setStatus('Egreso eliminado ✔')
      fetchDay(date)
    } catch (err) { setStatus('Error: ' + err.message) }
  }

  // ── Catalog helpers (admin only) ──────────────────────────────────────────
  const addCatalogRow    = () => { setCatalogDirty(true); setPaused(true); setData(d => ({ ...d, catalog: [...(d.catalog || []), { key: '', name: '', price: 0 }] })) }
  const updateCatalogCell = (idx, field, value) => { setCatalogDirty(true); setPaused(true); setData(d => ({ ...d, catalog: d.catalog.map((r, i) => i === idx ? { ...r, [field]: field === 'price' ? Number(value) || 0 : value } : r) })) }
  const deleteCatalogRow  = (idx) => { setCatalogDirty(true); setPaused(true); setData(d => ({ ...d, catalog: d.catalog.filter((_, i) => i !== idx) })) }
  const handleSaveCatalog = async () => {
    const cleaned = (data.catalog || []).filter(r => (r.name || '').trim()).map(r => ({ key: (r.key && r.key.trim()) ? r.key.trim() : (r.name || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''), name: r.name.trim(), price: Number(r.price) || 0 }))
    if (!cleaned.length) return alert('El catálogo no puede quedar vacío.')
    setStatus('Guardando catálogo…')
    try {
      await saveCatalog(date, cleaned)
      setCatalogDirty(false); setPaused(false)
      setStatus('Catálogo guardado ✔')
      fetchDay(date)
    } catch (err) { setStatus('Error: ' + err.message) }
  }

  const handleConsolidate = async () => {
    setStatus('Consolidando día…')
    try {
      const res = await consolidateDay(date)
      setStatus(res.ok ? `Consolidado ✔ (Ing: ${res.appendedIngresos}, Egr: ${res.appendedEgresos})` : 'No se pudo consolidar.')
      if (res.consolidatedUrl) window.open(res.consolidatedUrl, '_blank')
    } catch (err) { setStatus('Error: ' + err.message) }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const dayIncome   = data.incomes.reduce((s, x) => s + rowTotal(x), 0)
  const dayExpenses = data.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const dayBalance  = dayIncome - dayExpenses
  const balPos = dayBalance >= 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={layout}>
      {/* Sidebar */}
      <aside style={sidebar}>
        <div style={sideTop}>
          <div style={logo}>✦</div>
          <div style={logoText}>ODOMSA</div>
          <div style={logoBrand}>{session?.clinicName || 'Clínica Dental'}</div>
        </div>
        <div style={navItems}>
          <NavItem icon="📅" label="Día actual" />
        </div>
        <div style={sideBottom}>
          <div style={userInfo}>
            <div style={userAvatar}>{session?.email?.[0]?.toUpperCase()}</div>
            <div>
              <div style={userName}>{session?.email}</div>
              <Badge color={isAdmin ? 'teal' : 'muted'}>{isAdmin ? 'Admin' : 'Staff'}</Badge>
            </div>
          </div>
          <Btn variant="ghost" size="sm" onClick={logout} style={{ width: '100%', marginTop: '0.75rem' }}>
            Cerrar sesión
          </Btn>
        </div>
      </aside>

      {/* Main */}
      <main style={main}>
        {/* Header */}
        <div style={pageHeader} className="fade-up">
          <div>
            <h1 style={pageTitle}>Control del día</h1>
            <p style={pageSub}>Pacientes · Ingresos · Egresos</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isAdmin && (
              <Btn variant="success" onClick={handleConsolidate}>
                ⬆ Consolidar día
              </Btn>
            )}
            <div style={datePicker}>
              <label style={dateLabel}>Fecha</label>
              <input type="date" value={date} onChange={e => handleDateChange(e.target.value)} style={dateInput} />
            </div>
          </div>
        </div>

        {/* Status bar */}
        <StatusBar
          message={status} url={sheetUrl} lastSync={lastSync}
          onRefresh={() => fetchDay(date)} onTogglePause={() => setPaused(v => !v)}
          paused={paused} catalogDirty={catalogDirty} isAdmin={isAdmin}
        />

        {/* KPIs */}
        {isAdmin && (
          <div style={kpiGrid} className="fade-up">
            <StatCard label="Pacientes hoy"  value={data.incomes.length} />
            <StatCard label="Ingresos"  value={HNL(dayIncome)}   accent="var(--green)"        bg="var(--green-light)"  border="var(--green-light)" />
            <StatCard label="Egresos"   value={HNL(dayExpenses)} accent="var(--red)"          bg="var(--red-light)"   border="var(--red-light)" />
            <StatCard label="Balance"   value={HNL(dayBalance)}  accent={balPos ? 'var(--teal)' : 'var(--amber)'} bg={balPos ? 'var(--teal-light)' : 'var(--amber-light)'} border={balPos ? 'var(--teal-light)' : 'var(--amber-light)'} />
          </div>
        )}

        {/* Income form — staff + admin */}
        <Section title={editingIncomeId ? '✏️ Editar ingreso' : '➕ Registrar visita'}>
          <div style={formGrid4}>
            <div style={{ gridColumn: 'span 2' }}>
              <FieldLabel>Nombre del paciente</FieldLabel>
              <Input value={incomeForm.patientName} onChange={e => setIncomeForm({ ...incomeForm, patientName: e.target.value })} placeholder="Nombre completo" />
            </div>
            <div>
              <FieldLabel>Fecha del servicio</FieldLabel>
              <Input type="date" value={incomeForm.date} onChange={e => setIncomeForm({ ...incomeForm, date: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Forma de pago</FieldLabel>
              <Select value={incomeForm.payment} onChange={e => setIncomeForm({ ...incomeForm, payment: e.target.value })}>
                {PAYMENT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
          </div>

          {/* Service adder */}
          <div style={{ ...formGrid4, marginTop: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <FieldLabel>Servicio</FieldLabel>
              <Select value={serviceAdder.key} onChange={e => setServiceAdder({ ...serviceAdder, key: e.target.value })}>
                <option value="">— Seleccione —</option>
                {data.catalog.map(c => <option key={c.key + c.price} value={c.key}>{c.name} ({HNL(c.price)})</option>)}
                <option value="__custom__">Otro (personalizado)</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Cantidad</FieldLabel>
              <Input type="number" min="1" value={serviceAdder.qty} onChange={e => setServiceAdder({ ...serviceAdder, qty: e.target.value })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Btn onClick={addServiceToIncome} style={{ width: '100%' }}>+ Agregar</Btn>
            </div>
          </div>
          {serviceAdder.key === '__custom__' && (
            <div style={{ ...formGrid4, marginTop: '0.75rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <Input value={serviceAdder.customName} onChange={e => setServiceAdder({ ...serviceAdder, customName: e.target.value })} placeholder="Nombre del servicio" />
              </div>
              <div>
                <Input type="number" value={serviceAdder.price} onChange={e => setServiceAdder({ ...serviceAdder, price: e.target.value })} placeholder="Precio HNL" />
              </div>
            </div>
          )}

          {/* Services list */}
          {incomeForm.services.length > 0 && (
            <table style={table}>
              <thead><tr style={thead}>
                <th style={th}>Servicio</th><th style={th}>Precio</th><th style={th}>Cant.</th><th style={th}>Subtotal</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {incomeForm.services.map(s => (
                  <tr key={s.id} style={trow}>
                    <td style={td}>{s.name}</td>
                    <td style={td}>{HNL(s.price)}</td>
                    <td style={td}>{s.qty}</td>
                    <td style={td}>{HNL((Number(s.price) || 0) * (Number(s.qty) || 1))}</td>
                    <td style={td}><Btn size="sm" variant="danger" onClick={() => setIncomeForm(f => ({ ...f, services: f.services.filter(x => x.id !== s.id) }))}>Quitar</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Notas</FieldLabel>
              <textarea rows={2} value={incomeForm.notes} onChange={e => setIncomeForm({ ...incomeForm, notes: e.target.value })} style={{ ...inputStyle, resize: 'vertical', height: 'auto' }} />
            </div>
            <div style={totalBox}>
              <div style={totalLabel}>Total visita</div>
              <div style={totalValue}>{HNL(incomeForm.services.length ? incomeTotalLocal(incomeForm) : (Number(incomeForm.totalHNL) || 0))}</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <Btn variant="primary" onClick={submitIncome} style={{ flex: 1 }}>
                  {editingIncomeId ? 'Guardar cambios' : 'Registrar'}
                </Btn>
                {editingIncomeId && <Btn variant="ghost" onClick={() => { setEditingIncomeId(null); setIncomeForm({ patientName: '', services: [], date, payment: PAYMENT_TYPES[0], notes: '', totalHNL: 0 }) }}>Cancelar</Btn>}
              </div>
            </div>
          </div>
        </Section>

        {/* Income table */}
        <Section title="Pacientes del día">
          <table style={table}>
            <thead><tr style={thead}>
              <th style={th}>Fecha</th><th style={th}>Paciente</th><th style={th}>Servicios</th><th style={th}>Pago</th><th style={th}>Total</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {data.incomes.length === 0 && <tr><td colSpan={6} style={{ ...td, color: 'var(--ink-muted)', padding: '1.5rem 0.75rem' }}>Sin ingresos todavía.</td></tr>}
              {data.incomes.map(ing => (
                <tr key={ing.id} style={trow}>
                  <td style={td}>{ing.date}</td>
                  <td style={td}>{ing.patientName}</td>
                  <td style={td}><span style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{ing.servicesText || '—'}</span></td>
                  <td style={td}><Badge color="muted">{ing.payment}</Badge></td>
                  <td style={{ ...td, fontWeight: 600 }}>{HNL(rowTotal(ing))}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Btn size="sm" variant="ghost" onClick={() => editIncome(ing.id)}>Editar</Btn>
                      {isAdmin && <Btn size="sm" variant="danger" onClick={() => handleDeleteIncome(ing.id)}>Eliminar</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Expense form */}
        <Section title={editingExpenseId ? '✏️ Editar egreso' : '➕ Registrar egreso'} right={<span style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Total: {HNL(dayExpenses)}</span>}>
          <div style={formGrid4}>
            <div>
              <FieldLabel>Fecha</FieldLabel>
              <Input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <FieldLabel>Concepto</FieldLabel>
              <input list="conceptosRef" value={expenseForm.concept} onChange={e => setExpenseForm({ ...expenseForm, concept: e.target.value })} placeholder="Concepto del egreso" style={inputStyle} />
              <datalist id="conceptosRef">{EXPENSE_REF.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <FieldLabel>Monto (HNL)</FieldLabel>
              <Input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <FieldLabel>Notas</FieldLabel>
            <textarea rows={2} value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} style={{ ...inputStyle, resize: 'vertical', height: 'auto' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <Btn variant="primary" onClick={submitExpense}>{editingExpenseId ? 'Guardar cambios' : 'Registrar egreso'}</Btn>
            {editingExpenseId && <Btn variant="ghost" onClick={() => { setEditingExpenseId(null); setExpenseForm({ date, concept: '', amount: '', notes: '' }) }}>Cancelar</Btn>}
          </div>

          <table style={{ ...table, marginTop: '1.5rem' }}>
            <thead><tr style={thead}>
              <th style={th}>Fecha</th><th style={th}>Concepto</th><th style={th}>Monto</th><th style={th}>Notas</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {data.expenses.length === 0 && <tr><td colSpan={5} style={{ ...td, color: 'var(--ink-muted)', padding: '1.5rem 0.75rem' }}>Sin egresos todavía.</td></tr>}
              {data.expenses.map(e => (
                <tr key={e.id} style={trow}>
                  <td style={td}>{e.date}</td>
                  <td style={td}>{e.concept}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{HNL(e.amount)}</td>
                  <td style={{ ...td, color: 'var(--ink-muted)', fontSize: '0.85rem' }}>{e.notes || '—'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Btn size="sm" variant="ghost" onClick={() => editExpense(e.id)}>Editar</Btn>
                      {isAdmin && <Btn size="sm" variant="danger" onClick={() => handleDeleteExpense(e.id)}>Eliminar</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Catalog — admin only */}
        {isAdmin && (
          <Section title="Catálogo de servicios" right={
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Btn size="sm" variant="ghost" onClick={addCatalogRow}>+ Fila</Btn>
              <Btn size="sm" variant="primary" onClick={handleSaveCatalog}>Guardar catálogo</Btn>
              {catalogDirty && <Btn size="sm" variant="ghost" onClick={() => { setCatalogDirty(false); setPaused(false); fetchDay(date) }}>Descartar</Btn>}
            </div>
          }>
            <table style={table}>
              <thead><tr style={thead}>
                <th style={th}>Clave</th><th style={th}>Servicio</th><th style={th}>Precio (HNL)</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {data.catalog.map((c, idx) => (
                  <tr key={(c.key || 'k') + idx} style={trow}>
                    <td style={td}><Input value={c.key || ''} onChange={e => updateCatalogCell(idx, 'key', e.target.value)} style={{ ...inputStyle, width: '120px' }} /></td>
                    <td style={td}><Input value={c.name || ''} onChange={e => updateCatalogCell(idx, 'name', e.target.value)} /></td>
                    <td style={td}><Input type="number" value={c.price || 0} onChange={e => updateCatalogCell(idx, 'price', e.target.value)} style={{ ...inputStyle, width: '120px' }} /></td>
                    <td style={td}><Btn size="sm" variant="danger" onClick={() => deleteCatalogRow(idx)}>Eliminar</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <footer style={footer}>
          Tomalá, Lempira, Honduras · ODOMSA · {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  )
}

// ── Mini components ───────────────────────────────────────────────────────────
const inputStyle = { width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', background: '#fff', color: 'var(--ink)', fontSize: '0.9rem', outline: 'none' }
const Input  = ({ style: extra, ...p }) => <input  style={{ ...inputStyle, ...extra }} {...p} />
const Select = ({ children, style: extra, ...p }) => <select style={{ ...inputStyle, ...extra }} {...p}>{children}</select>
const FieldLabel = ({ children }) => <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '0.35rem' }}>{children}</label>
const NavItem = ({ icon, label }) => <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}><span>{icon}</span>{label}</div>

// ── Styles ────────────────────────────────────────────────────────────────────
const layout     = { display: 'flex', minHeight: '100vh' }
const sidebar    = { width: '240px', flexShrink: 0, background: 'linear-gradient(180deg,#0D9488,#065F46)', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem' }
const sideTop    = { textAlign: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.15)' }
const logo       = { fontSize: '1.5rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.25rem' }
const logoText   = { fontFamily: "'DM Serif Display',serif", fontSize: '1.5rem', color: '#fff', letterSpacing: '0.1em' }
const logoBrand  = { fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.2rem' }
const navItems   = { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }
const sideBottom = { borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '1.25rem', marginTop: '1rem' }
const userInfo   = { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }
const userAvatar = { width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.9rem', flexShrink: 0 }
const userName   = { fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', wordBreak: 'break-all', marginBottom: '0.25rem' }
const main       = { flex: 1, padding: '2rem', overflowY: 'auto', background: 'var(--cream)' }
const pageHeader = { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }
const pageTitle  = { fontSize: '1.8rem', color: 'var(--ink)' }
const pageSub    = { fontSize: '0.875rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }
const datePicker = { display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const dateLabel  = { fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-muted)', letterSpacing: '0.04em' }
const dateInput  = { padding: '0.5rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', background: '#fff', color: 'var(--ink)', fontSize: '0.9rem', outline: 'none' }
const kpiGrid    = { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }
const formGrid4  = { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }
const table      = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }
const thead      = { borderBottom: '2px solid var(--border)' }
const th         = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-muted)' }
const trow       = { borderBottom: '1px solid var(--border)' }
const td         = { padding: '0.7rem 0.75rem', verticalAlign: 'middle' }
const totalBox   = { background: 'var(--cream)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', minWidth: '200px' }
const totalLabel = { fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-muted)', letterSpacing: '0.05em', marginBottom: '0.4rem' }
const totalValue = { fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal-dark)' }
const footer     = { fontSize: '0.78rem', color: 'var(--ink-muted)', textAlign: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }
