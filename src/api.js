// api.js — all API calls to GAS backends

// Auth always goes to Tomala (centralised ODOMSA-Users sheet)
const AUTH_URL = 'https://script.google.com/macros/s/AKfycbw6npDTpziujj1fo2q5GEwlJYZrznqIdfMb7ZFiSJ-2ZOXYSdQ2cyf7hufhE8lO4lAj/exec'

// Data calls use whichever clinic was selected — stored in sessionStorage
function getClinicUrl() {
  try {
    const s = JSON.parse(sessionStorage.getItem('odomsa_session') || '{}')
    return s.clinicUrl || AUTH_URL
  } catch { return AUTH_URL }
}

async function gasCall(action, payload = {}, useAuthUrl = false) {
  try {
    const s = JSON.parse(sessionStorage.getItem('odomsa_session') || '{}')
    const token = s.token || ''
    const url = useAuthUrl ? AUTH_URL : getClinicUrl()
    const body = JSON.stringify({ action, token, ...payload })

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data
  } catch (err) {
    throw new Error(err.message || 'No se pudo conectar con el servidor. Intenta de nuevo.')
  }
}

// ── Auth (always Tomala / centralised) ───────────────────────────────────────

export async function validateUser(email, password) {
  return gasCall('validateUser', { email, password }, true)
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getDayData(dateStr) {
  return gasCall('getDayData', { dateStr })
}

// ── Income ───────────────────────────────────────────────────────────────────

export async function addIncome(ing) {
  return gasCall('addIncome', { ing })
}

export async function updateIncome(ing) {
  return gasCall('updateIncome', { ing })
}

export async function deleteIncome(payload) {
  return gasCall('deleteIncome', { payload })
}

// ── Expense ──────────────────────────────────────────────────────────────────

export async function addExpense(exp) {
  return gasCall('addExpense', { exp })
}

export async function updateExpense(exp) {
  return gasCall('updateExpense', { exp })
}

export async function deleteExpense(payload) {
  return gasCall('deleteExpense', { payload })
}

// ── Catalog ──────────────────────────────────────────────────────────────────

export async function saveCatalog(dateStr, items) {
  return gasCall('saveCatalog', { dateStr, items })
}

// ── Consolidate ───────────────────────────────────────────────────────────────

export async function consolidateDay(dateStr) {
  return gasCall('consolidateDay', { dateStr })
}
