import { useState, useRef, useEffect } from 'react'
import { formatDateDisplay } from './FormatDate'

const VIETNAMESE_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

function getDaysInMonth(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  return days
}

function formatDateValue(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Custom DatePicker
 * - Mobile  : bottom-sheet slide-up
 * - Desktop : absolute popover positioned below the trigger
 */
export default function DatePicker({
  value,
  onChange,
  id,
  'aria-label': ariaLabel,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.split('-')[0])
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return parseInt(value.split('-')[1]) - 1
    return new Date().getMonth()
  })

  // Detect desktop (≥ 1024px) for popover vs bottom-sheet
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen || !isDesktop) return
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, isDesktop])

  const days = getDaysInMonth(viewYear, viewMonth)

  const handlePrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleDaySelect = (day) => {
    onChange(formatDateValue(viewYear, viewMonth, day))
    setIsOpen(false)
  }

  const isSelectedDay = (day) => {
    if (!day || !value) return false
    const [y, m, d] = value.split('-').map(Number)
    return y === viewYear && m - 1 === viewMonth && d === day
  }

  const isToday = (day) => {
    if (!day) return false
    const t = new Date()
    return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === day
  }

  // ─── Shared Calendar Content ───────────────────────────────────────────────
  const CalendarContent = () => (
    <>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">
          Tháng {MONTHS[viewMonth]} / {viewYear}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-1">
        {VIETNAMESE_WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, index) => (
          <div key={index} className="aspect-square flex items-center justify-center">
            {day ? (
              <button
                type="button"
                onClick={() => handleDaySelect(day)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  isSelectedDay(day)
                    ? 'bg-[#1e3a5f] text-white shadow-md'
                    : isToday(day)
                    ? 'border-2 border-[#1e3a5f] text-[#1e3a5f]'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {day}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {/* Today shortcut */}
      <div className="mt-3 pt-2.5 border-t border-gray-100">
        <button
          type="button"
          onClick={() => {
            const t = new Date()
            setViewYear(t.getFullYear())
            setViewMonth(t.getMonth())
            onChange(formatDateValue(t.getFullYear(), t.getMonth(), t.getDate()))
            setIsOpen(false)
          }}
          className="w-full py-2 text-xs font-semibold text-[#1e3a5f] hover:bg-blue-50 rounded-lg transition-colors"
        >
          Hôm nay
        </button>
      </div>
    </>
  )

  // ─── Trigger Button ─────────────────────────────────────────────────────────
  // Styled to match input fields: same border, padding, height, radius
  const Trigger = () => (
    <button
      type="button"
      id={id}
      aria-label={ariaLabel || 'Chọn ngày'}
      onClick={() => setIsOpen((v) => !v)}
      className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm bg-white outline-none transition
        hover:border-slate-300 focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]
        border-slate-200 cursor-pointer ${className}`}
    >
      <span className={value ? 'text-slate-800' : 'text-slate-400'}>
        {value ? formatDateDisplay(value) : 'dd/MM/yyyy'}
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 flex-shrink-0 ml-2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </button>
  )

  // ─── Desktop: Absolute Popover ───────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div ref={wrapperRef} className="relative w-full">
        <Trigger />
        {isOpen && (
          <div
            className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-[200] p-4"
            style={{ minWidth: '260px' }}
          >
            <CalendarContent />
          </div>
        )}
      </div>
    )
  }

  // ─── Mobile: Bottom Sheet ────────────────────────────────────────────────────
  return (
    <>
      <Trigger />
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-0 left-0 w-full bg-white rounded-t-2xl p-5 z-50 shadow-xl">
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <CalendarContent />
          </div>
        </>
      )}
    </>
  )
}
