import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatVnd } from '../components/FormatNumber'

// ─────────────────────────────────────────
// External Components
// ─────────────────────────────────────────
import S1AList from '../components/s1a/S1AList'
import AddTicketForm from '../components/s1a/AddTicketForm'
import AddMonthlyRevenueForm from '../components/s1a/AddMonthlyRevenueForm'
import SoS1aHKD from '../components/s1a/SoS1aHKD'
import CloseBookForm from '../components/s1a/CloseBookForm'
import S2aImportWizard from '../components/s1a/S2aImportWizard'

// Feature flag — Sprint 1: PDF import UI only.
// Enable during development; disable before production release
// until PDF analysis is fully implemented.
const FEATURE_S2A_IMPORT_ENABLED = true

// ─────────────────────────────────────────
// Hub Page - Navigation Cards
// ─────────────────────────────────────────
const NAV_CARDS = [
  {
    id: 'list',
    title: 'Danh sách doanh thu',
    desc: 'Xem doanh thu theo ngày',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    id: 'add',
    title: 'Ghi nhận doanh thu',
    desc: 'Nhập doanh thu một ngày',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  /* 
  Temporarily hidden because monthly-entry logic conflicts with the one-day-one-record S1A rule.
  {
    id: 'batchAdd',
    title: 'Doanh thu tháng',
    desc: 'Nhập số liệu',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
        <line x1="12" y1="11" x2="12" y2="17" />
      </svg>
    ),
  },
  */
  {
    id: 'ledger',
    title: 'Sổ S1A',
    desc: 'Xem báo cáo theo mẫu thuế',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: 'closeBook',
    title: 'Chốt sổ S1A',
    desc: 'Khóa dữ liệu kỳ kế toán',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  ...(FEATURE_S2A_IMPORT_ENABLED ? [{
    id: 'importHistory',
    title: 'Nhập dữ liệu lịch sử',
    desc: 'Chuyển sổ S2A cũ vào S1A',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  }] : []),
]

// ─────────────────────────────────────────
// Main Component: HoSoS1A
// ─────────────────────────────────────────
export default function HoSoS1A() {
  const [view, setView] = useState('hub')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ tickets: 0, total: 0 })

  const fetchStats = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    setLoading(true)
    try {
      const { data } = await supabase.from('sales_tickets').select('total_amount, sale_date')
      if (data) {
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const monthData = data.filter(t => {
          if (!t.sale_date) return false
          return t.sale_date.slice(0, 7) === currentMonth
        })
        const total = monthData.reduce((s, t) => s + (Number(t.total_amount) || 0), 0)
        setStats({ tickets: monthData.length, total })
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const handleBack = useCallback(() => {
    setView('hub')
    fetchStats()
  }, [fetchStats])

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 sm:pb-24">
      {/* Hub View */}
      {view === 'hub' && (
        <>
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Hồ sơ S1A
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 sm:text-base">
              Sổ doanh thu bán hàng hóa, dịch vụ · Thông tư 152/2025/TT-BTC
            </p>
          </div>

          {/* Stats Bar */}
          <div className="mb-8 flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Stat: Tickets */}
            <div className="flex flex-1 flex-col justify-center px-5 py-5 border-b sm:border-b-0 sm:border-r border-slate-100">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {loading ? '—' : stats.tickets}
              </span>
              <span className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Ngày có dữ liệu tháng này
              </span>
            </div>
            
            {/* Stat: Revenue */}
            <div className="flex flex-1 flex-col justify-center px-5 py-5 bg-slate-50/50">
              <span className="text-3xl font-bold tracking-tight text-brand-600">
                {loading ? '—' : formatVnd(stats.total)}
                {!loading && <span className="ml-1.5 text-base font-semibold text-brand-500">đ</span>}
              </span>
              <span className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Tổng doanh thu tháng này
              </span>
            </div>
          </div>

          {/* Main Actions Grid (3 cards) */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {NAV_CARDS.filter(c => c.id !== 'closeBook' && c.id !== 'batchAdd').map((card) => (
              <button
                key={card.id}
                type="button"
                className="
                  group relative flex min-h-[96px] w-full items-center gap-4
                  rounded-2xl border border-slate-200 bg-white p-4
                  transition-all duration-200 ease-out
                  hover:border-brand-300 hover:shadow-md
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                "
                onClick={() => setView(card.id)}
              >
                {/* Icon */}
                <div className="
                  flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
                  bg-brand-50 text-brand-600
                  transition-colors duration-200 group-hover:bg-brand-100
                ">
                  {card.icon}
                </div>
                
                {/* Text */}
                <div className="flex flex-1 flex-col text-left">
                  <div className="text-base font-semibold text-slate-900 md:text-lg">
                    {card.title}
                  </div>
                  <div className="mt-0.5 text-[13px] text-slate-500 line-clamp-1">
                    {card.desc}
                  </div>
                </div>

                {/* Chevron */}
                <div className="shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-brand-500">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>

          {/* Secondary Actions (Full width) */}
          <div className="grid grid-cols-1">
            {NAV_CARDS.filter(c => c.id === 'closeBook' || c.id === 'importHistory').map((card) => (
              <button
                key={card.id}
                type="button"
                className="
                  group relative flex min-h-[88px] w-full items-center gap-4
                  rounded-2xl border border-slate-200 bg-slate-50 p-4
                  transition-all duration-200 ease-out
                  hover:border-brand-300 hover:bg-white hover:shadow-md
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                "
                onClick={() => setView(card.id)}
              >
                {/* Icon */}
                <div className="
                  flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                  bg-slate-200 text-slate-600
                  transition-colors duration-200 group-hover:bg-brand-50 group-hover:text-brand-600
                ">
                  {card.icon}
                </div>
                
                {/* Text */}
                <div className="flex flex-1 flex-col text-left">
                  <div className="text-[15px] font-semibold text-slate-800 md:text-base">
                    {card.title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {card.desc}
                  </div>
                </div>

                {/* Chevron */}
                <div className="shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-brand-500">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Sub-pages */}
      {view === 'list' && <S1AList onBack={handleBack} />}
      {view === 'add' && <AddTicketForm onBack={handleBack} />}
      {view === 'batchAdd' && <AddMonthlyRevenueForm onBack={handleBack} />}
      {view === 'ledger' && <SoS1aHKD onBack={handleBack} />}
      {view === 'closeBook' && <CloseBookForm onBack={handleBack} />}
      {view === 'importHistory' && <S2aImportWizard onBack={handleBack} />}
    </div>
  )
}
