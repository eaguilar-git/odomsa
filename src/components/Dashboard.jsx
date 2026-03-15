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
