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

// ─────────────────────────────────────────
// Hub Page - Navigation Cards
// ─────────────────────────────────────────
const NAV_CARDS = [
  {
    id: 'list',
    title: 'Danh sách phiếu',
    desc: 'Xem & quản lý',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    id: 'add',
    title: 'Thêm phiếu',
    desc: 'Tạo phiếu mới',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
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
  {
    id: 'ledger',
    title: 'Sổ S1A-HKD',
    desc: 'Xem báo cáo',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
    desc: 'Khóa dữ liệu',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
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
    <div className="page-shell">
      {/* Hub View */}
      {view === 'hub' && (
        <>
          <div className="page-topbar-new">
            <h1 className="page-title-new">Hồ sơ S1A</h1>
            <p className="page-subtitle-new">Sổ doanh thu bán hàng hóa, dịch vụ · Thông tư 152/2025/TT-BTC</p>
          </div>

          <div className="hub-stats-bar">
            <div className="hub-stat">
              <span className="hub-stat-value">{loading ? '—' : stats.tickets}</span>
              <span className="hub-stat-label">Phiếu phát sinh tháng này</span>
            </div>
            <div className="hub-stat-divider" />
            <div className="hub-stat">
              <span className="hub-stat-value text-emerald">{loading ? '—' : formatVnd(stats.total)}</span>
              <span className="hub-stat-label">Tổng doanh thu tháng này</span>
            </div>
          </div>

          <div className="nav-cards-grid">
            {NAV_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                className="nav-card"
                onClick={() => setView(card.id)}
              >
                <div className="nav-card-icon">{card.icon}</div>
                <div className="nav-card-body">
                  <div className="nav-card-title">{card.title}</div>
                  <div className="nav-card-desc">{card.desc}</div>
                </div>
                <div className="nav-card-arrow">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    </div>
  )
}
