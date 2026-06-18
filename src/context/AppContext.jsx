import { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_INVENTORY_CATEGORIES,
  loadInventory,
  saveInventory,
  loadS2aSettings,
  saveS2aSettings,
  loadFreshFoodPurchases,
  saveFreshFoodPurchases,
  loadFreshFoodPurchasesDaily,
  saveFreshFoodPurchasesDaily,
  loadVatInvoices,
  saveVatInvoices,
  loadCompanies,
  saveCompanies,
} from '../data/constants'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AppContext = createContext(null)

function inventoryReducer(state, action) {
  switch (action.type) {
    case 'SET_INVENTORY':
      return action.payload
    case 'RESET_TO_DEFAULT':
      return DEFAULT_INVENTORY_CATEGORIES.map(c => ({ ...c }))
    default:
      return state
  }
}

function vatInvoicesReducer(state, action) {
  switch (action.type) {
    case 'SET':
      return action.payload
    case 'ADD':
      return [...state, action.payload]
    case 'UPDATE':
      return state.map(e => e.id === action.payload.id ? { ...e, ...action.payload.updates } : e)
    case 'DELETE':
      return state.filter(e => e.id !== action.payload)
    default:
      return state
  }
}

function companiesReducer(state, action) {
  switch (action.type) {
    case 'SET':
      return action.payload
    case 'ADD':
      return [...state, action.payload]
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [inventory, dispatchInventory] = useReducer(inventoryReducer, null, loadInventory)
  const [vatInvoices, dispatchVatInvoices] = useReducer(vatInvoicesReducer, null, loadVatInvoices)
  const [companies, dispatchCompanies] = useReducer(companiesReducer, null, loadCompanies)
  const [freshFoodPurchases, setFreshFoodPurchasesState] = useState(loadFreshFoodPurchases)
  const [freshFoodPurchasesDaily, setFreshFoodPurchasesDailyState] = useState(loadFreshFoodPurchasesDaily)

  // S1A State - Load tu Supabase thay vi localStorage
  const [closedPeriods, setClosedPeriodsState] = useState([])

  const setFreshFoodPurchaseForMonth = useCallback((month, amount) => {
    setFreshFoodPurchasesState((prev) => {
      const next = prev.some((e) => e.month === month)
        ? prev.map((e) => (e.month === month ? { month, amount } : e))
        : [...prev, { month, amount }].sort((a, b) => b.month.localeCompare(a.month))
      saveFreshFoodPurchases(next)
      return next
    })
  }, [])

  const deleteFreshFoodPurchase = useCallback((month) => {
    setFreshFoodPurchasesState((prev) => {
      const next = prev.filter((e) => e.month !== month)
      saveFreshFoodPurchases(next)
      return next
    })
  }, [])

  const setFreshFoodPurchaseForDay = useCallback((date, amount) => {
    setFreshFoodPurchasesDailyState((prev) => {
      const next = prev.some((e) => e.date === date)
        ? prev.map((e) => (e.date === date ? { date, amount } : e))
        : [...prev, { date, amount }].sort((a, b) => b.date.localeCompare(a.date))
      saveFreshFoodPurchasesDaily(next)
      return next
    })
  }, [])

  const deleteFreshFoodPurchaseDay = useCallback((date) => {
    setFreshFoodPurchasesDailyState((prev) => {
      const next = prev.filter((e) => e.date !== date)
      saveFreshFoodPurchasesDaily(next)
      return next
    })
  }, [])

  const getFreshFoodPurchaseForMonth = useCallback((ym) => {
    const monthly = freshFoodPurchases ?? loadFreshFoodPurchases()
    const daily = freshFoodPurchasesDaily ?? loadFreshFoodPurchasesDaily()
    const monthEntry = monthly.find((e) => e.month === ym)
    const dailyInMonth = daily.filter((e) => (e.date || '').slice(0, 7) === ym)
    if (monthEntry != null) return (monthEntry.amount ?? 0) + dailyInMonth.reduce((s, e) => s + (e.amount ?? 0), 0)
    if (dailyInMonth.length > 0) return dailyInMonth.reduce((s, e) => s + (e.amount ?? 0), 0)
    return null
  }, [freshFoodPurchases, freshFoodPurchasesDaily])

  const getFreshFoodPurchaseForDay = useCallback((dateStr) => {
    const daily = freshFoodPurchasesDaily ?? loadFreshFoodPurchasesDaily()
    const monthly = freshFoodPurchases ?? loadFreshFoodPurchases()
    const dayEntry = daily.find((e) => e.date === dateStr)
    if (dayEntry != null) return dayEntry.amount ?? 0
    const ym = (dateStr || '').slice(0, 7)
    const monthEntry = monthly.find((e) => e.month === ym)
    if (monthEntry == null) return null
    const daysInMonth = new Date(parseInt(ym.slice(0, 4), 10), parseInt(ym.slice(5, 7), 10), 0).getDate()
    return (monthEntry.amount ?? 0) / daysInMonth
  }, [freshFoodPurchases, freshFoodPurchasesDaily])

  const setS2aSettings = useCallback((data) => {
    setS2aSettingsState((prev) => {
      const next = typeof data === 'function' ? data(prev) : { ...prev, ...data }
      saveS2aSettings(next)
      return next
    })
  }, [])

  // Load closed periods tu Supabase
  const loadClosedPeriods = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    try {
      const { data, error } = await supabase
        .from('closed_periods')
        .select('period_month')
        .order('period_month', { ascending: false })

      if (error) throw error
      const periods = (data || []).map((row) => row.period_month)
      setClosedPeriodsState(periods)
    } catch (err) {
      console.error('Loi load closed periods:', err)
    }
  }, [])

  // Close period - Insert vao Supabase
  const closePeriod = useCallback(async (ym) => {
    const key = String(ym).slice(0, 7)
    if (closedPeriods.includes(key)) return

    if (!isSupabaseConfigured()) {
      onNotify?.({ type: 'error', text: 'Chua ket noi Supabase.' })
      return
    }

    try {
      const { error } = await supabase
        .from('closed_periods')
        .insert([{ period_month: key }])

      if (error) throw error

      setClosedPeriodsState((prev) => [...prev, key].sort())
    } catch (err) {
      console.error('Loi chot so:', err)
      throw err
    }
  }, [closedPeriods])

  const isPeriodClosed = useCallback((dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return false
    const ym = dateStr.slice(0, 7)
    return closedPeriods.includes(ym)
  }, [closedPeriods])

  const setInventory = useCallback((data) => {
    dispatchInventory({ type: 'SET_INVENTORY', payload: data })
    saveInventory(data)
  }, [])

  const resetInventoryToDefault = useCallback(() => {
    const data = DEFAULT_INVENTORY_CATEGORIES.map(c => ({ ...c }))
    dispatchInventory({ type: 'RESET_TO_DEFAULT' })
    saveInventory(data)
  }, [])

  const addVatInvoice = useCallback((entry) => {
    const item = { ...entry, id: entry.id || crypto.randomUUID() }
    dispatchVatInvoices({ type: 'ADD', payload: item })
  }, [])

  const updateVatInvoice = useCallback((id, updates) => {
    dispatchVatInvoices({ type: 'UPDATE', payload: { id, updates } })
  }, [])

  const deleteVatInvoice = useCallback((id) => {
    dispatchVatInvoices({ type: 'DELETE', payload: id })
  }, [])

  const addCompany = useCallback((company) => {
    const item = { id: company.id || crypto.randomUUID(), name: company.name || '', mst: company.mst || '' }
    dispatchCompanies({ type: 'ADD', payload: item })
  }, [])

  // Load closed periods khi app start
  useEffect(() => {
    loadClosedPeriods()
  }, [loadClosedPeriods])

  useEffect(() => {
    const list = vatInvoices ?? loadVatInvoices()
    if (Array.isArray(list)) saveVatInvoices(list)
  }, [vatInvoices])

  useEffect(() => {
    const list = companies ?? loadCompanies()
    if (Array.isArray(list)) saveCompanies(list)
  }, [companies])

  const value = {
    inventory: inventory || loadInventory(),
    setInventory,
    resetInventoryToDefault,
    closedPeriods,
    setClosedPeriods: setClosedPeriodsState,
    closePeriod,
    isPeriodClosed,
    loadClosedPeriods,
    vatInvoices: vatInvoices ?? loadVatInvoices(),
    addVatInvoice,
    updateVatInvoice,
    deleteVatInvoice,
    companies: companies ?? loadCompanies(),
    addCompany,
    freshFoodPurchases: freshFoodPurchases ?? loadFreshFoodPurchases(),
    setFreshFoodPurchaseForMonth,
    deleteFreshFoodPurchase,
    freshFoodPurchasesDaily: freshFoodPurchasesDaily ?? loadFreshFoodPurchasesDaily(),
    setFreshFoodPurchaseForDay,
    deleteFreshFoodPurchaseDay,
    getFreshFoodPurchaseForMonth,
    getFreshFoodPurchaseForDay,
    s2aSettings: loadS2aSettings(),
    setS2aSettings,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
