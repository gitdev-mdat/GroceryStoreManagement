import { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'
import {
  S1AList,
  AddTicketForm,
  AddMonthlyRevenueForm,
  S1ABookPrint,
  CloseBookForm,
} from '../components/s1a'

// Navigation tabs config
const SECTIONS = [
  { id: 'list',      label: 'Danh sách phiếu',           icon: '📋' },
  { id: 'add',       label: 'Thêm phiếu',                 icon: '➕' },
  { id: 'batchAdd',  label: 'Thêm doanh thu tháng',     icon: '📅' },
  { id: 'ledgerS1a', label: 'Sổ S1a-HKD',               icon: '🖨️' },
  { id: 'closeBook', label: 'Chốt sổ S1A',                   icon: '🔒' },
]

export default function HoSoS1A() {
  const { showToast, ToastContainer } = useToast()
  const [activeSection, setActiveSection] = useState('list')
  const [notify, setNotify] = useState(null)

  // Toast effect
  useEffect(() => {
    if (!notify) return
    const t = setTimeout(() => setNotify(null), 4000)
    return () => clearTimeout(t)
  }, [notify])

  // Handle notify from child components
  const handleNotify = (msg) => {
    if (msg) {
      setNotify(msg)
      if (msg.type === 'success') {
        showToast(msg.text, 'success')
      } else {
        showToast(msg.text, 'error')
      }
    }
  }

  return (
    <div className="page-shell">
      <ToastContainer />

      {/* Page Header */}
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ho so S1A</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            So Doanh thu ban hang hoa, dich vu · Thong tu 152/2025/TT-BTC
          </p>
        </div>

        {/* Bento Grid Navigation */}
        <nav className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-50/60 rounded-2xl border border-slate-100/80">
          {SECTIONS.map(({ id, label, icon }) => {
            const isActive = activeSection === id
            const isLast = id === 'closeBook'
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={[
                  'flex flex-col items-center justify-center p-3.5 rounded-xl shadow-sm transition-all active:scale-95 w-full',
                  'border bg-white',
                  isActive
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-100 hover:border-blue-300 hover:bg-white',
                  isLast ? 'col-span-2 md:col-span-1' : '',
                ].join(' ')}
              >
                <span className={['text-lg mb-1.5', isActive ? 'text-blue-600' : 'text-slate-600'].join(' ')}>
                  {icon}
                </span>
                <span className={[
                  'text-xs text-center font-medium line-clamp-1',
                  isActive ? 'text-blue-600 font-semibold' : 'text-slate-600',
                ].join(' ')}>
                  {label}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Notify Banner */}
      {notify && (
        <div
          role="alert"
          className={[
            'mb-4 px-4 py-3 rounded-lg border text-sm',
            notify.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200',
          ].join(' ')}
        >
          {notify.text}
        </div>
      )}

      {/* Dynamic Content Area */}
      <div className="mt-4">
        {activeSection === 'list' && <S1AList onNotify={handleNotify} />}
        {activeSection === 'add' && <AddTicketForm onNotify={handleNotify} />}
        {activeSection === 'batchAdd' && <AddMonthlyRevenueForm onNotify={handleNotify} />}
        {activeSection === 'ledgerS1a' && <S1ABookPrint />}
        {activeSection === 'closeBook' && <CloseBookForm onNotify={handleNotify} />}
      </div>
    </div>
  )
}
