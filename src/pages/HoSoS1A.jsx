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

// ─────────────────────────────────────────
// Sub-page Wrappers (lightweight shells)
// ─────────────────────────────────────────
function LedgerPage({ onBack }) {
  return (
    <div className="sub-page">
      <div className="sub-page-header">
        <button type="button" className="back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại Hub
        </button>
        <div className="sub-page-title">
          <h2>Sổ S1A-HKD</h2>
          <p className="sub-page-subtitle">Mẫu sổ theo Thông tư 152/2025/TT-BTC</p>
        </div>
      </div>
      <div className="sub-page-content">
        <div className="form-card">
          <p className="form-hint">Hệ thống tự động gom toàn bộ phiếu doanh thu trong kỳ kê khai, tổng hợp theo 3 cột chuẩn.</p>
          <SoS1aHKD />
        </div>
      </div>
    </div>
  )
}

function CloseBookPage({ onBack }) {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [closedPeriods, setClosedPeriods] = useState([])

  useEffect(() => {
    const stored = localStorage.getItem('closed_periods')
    if (stored) setClosedPeriods(JSON.parse(stored))
  }, [])

  const handleCloseBook = async () => {
    const ym = `${year}-${String(month).padStart(2, '0')}`
    if (closedPeriods.includes(ym)) {
      setMsg({ type: 'error', text: `Tháng ${month}/${year} đã được chốt sổ.` })
      return
    }
    setSubmitting(true)
    try {
      if (isSupabaseConfigured()) {
        await supabase.from('closed_periods').insert([{ period_month: ym }])
      }
      const updated = [...closedPeriods, ym].sort()
      setClosedPeriods(updated)
      localStorage.setItem('closed_periods', JSON.stringify(updated))
      setMsg({ type: 'success', text: `Đã chốt sổ tháng ${month}/${year}.` })
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Không thể chốt sổ.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sub-page">
      <div className="sub-page-header">
        <button type="button" className="back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại Hub
        </button>
        <div className="sub-page-title">
          <h2>Chốt sổ S1A</h2>
          <p className="sub-page-subtitle">Khoá số liệu kỳ kê khai</p>
        </div>
      </div>
      <div className="sub-page-content">
        <div className="form-card">
          <p className="form-hint">Sau khi chốt sổ, phiếu trong kỳ không thể chỉnh sửa hoặc xóa.</p>
          <div className="form-stack">
            <div className="form-row">
              <div className="form-group">
                <label>Tháng</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input-base">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Năm</label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(Number(e.target.value) || new Date().getFullYear())}
                  min={2020}
                  max={2030}
                  className="input-base"
                />
              </div>
              <div className="form-actions-self">
                <button type="button" className="btn btn-primary" onClick={handleCloseBook} disabled={submitting}>
                  {submitting ? 'Đang chốt...' : 'Chốt sổ tháng này'}
                </button>
              </div>
            </div>
            {msg && (
              <div className={`msg-box ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
                {msg.text}
              </div>
            )}
            <div className="closed-list">
              <strong className="text-sm font-semibold">Các kỳ đã chốt:</strong>
              {closedPeriods.length === 0 ? (
                <p className="text-sm text-muted mt-1">Chưa chốt kỳ nào.</p>
              ) : (
                <ul className="mt-1">
                  {closedPeriods.map(ym => {
                    const [y, m] = ym.split('-')
                    return <li key={ym} className="text-sm">Tháng {Number(m)}/{y}</li>
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Hub Page
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

export default function HoSoS1A() {
  const [view, setView] = useState('hub') // 'hub' | 'list' | 'add' | 'batchAdd' | 'ledger' | 'closeBook'
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ tickets: 0, total: 0 })

  // Fetch stats for hub
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

  // Re-fetch stats when returning to hub
  const handleBack = useCallback(() => {
    setView('hub')
    fetchStats()
  }, [fetchStats])

  return (
    <div className="page-shell">
      {view === 'hub' && (
        <>
          {/* Page Header */}
          <div className="page-topbar-new">
            <h1 className="page-title-new">Hồ sơ S1A</h1>
            <p className="page-subtitle-new">Sổ doanh thu bán hàng hóa, dịch vụ · Thông tư 152/2025/TT-BTC</p>
          </div>

          {/* Stats Bar */}
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

          {/* Navigation Cards Grid */}
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

      {/* Sub-pages - using external components */}
      {view === 'list' && <S1AList onBack={handleBack} />}
      {view === 'add' && <AddTicketForm onBack={handleBack} />}
      {view === 'batchAdd' && <AddMonthlyRevenueForm onBack={handleBack} />}
      {view === 'ledger' && <LedgerPage onBack={handleBack} />}
      {view === 'closeBook' && <CloseBookPage onBack={handleBack} />}
    </div>
  )
}
