const GAS_URL = import.meta.env.VITE_GAS_URL

async function gasCall(action, payload = {}) {
  const token = sessionStorage.getItem('odomsa_token')
  const body = JSON.stringify({ action, token, ...payload })
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export const validateUser  = (email, password) => gasCall('validateUser', { email, password })
export const getDayData    = (dateStr)          => gasCall('getDayData', { dateStr })
export const addIncome     = (ing)              => gasCall('addIncome', { ing })
export const updateIncome  = (ing)              => gasCall('updateIncome', { ing })
export const deleteIncome  = (payload)          => gasCall('deleteIncome', { payload })
export const addExpense    = (exp)              => gasCall('addExpense', { exp })
export const updateExpense = (exp)              => gasCall('updateExpense', { exp })
export const deleteExpense = (payload)          => gasCall('deleteExpense', { payload })
export const saveCatalog   = (dateStr, items)   => gasCall('saveCatalog', { dateStr, items })
export const consolidateDay = (dateStr)         => gasCall('consolidateDay', { dateStr })