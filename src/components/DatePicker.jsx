import { useState } from 'react'
import { formatDateDisplay } from './FormatDate'

const VIETNAMESE_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

function getDaysInMonth(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []

  // Padding for first week (0 = Sunday)
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d)
  }
  return days
}

function formatDateValue(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Custom DatePicker với Calendar Bottom Sheet
 * Hiển thị dd/MM/yyyy, chọn ngày qua Bottom Sheet mobile-first
 */
export default function DatePicker({ value, onChange, id, 'aria-label': ariaLabel, className = '' }) {
  const [isOpenCalendar, setIsOpenCalendar] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    if (value) {
      const [y, m] = value.split('-')
      return parseInt(y)
    }
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) {
      const [y, m] = value.split('-')
      return parseInt(m) - 1
    }
    return new Date().getMonth()
  })

  const days = getDaysInMonth(viewYear, viewMonth)

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const handleDaySelect = (day) => {
    const newValue = formatDateValue(viewYear, viewMonth, day)
    onChange(newValue)
    setIsOpenCalendar(false)
  }

  const isSelectedDay = (day) => {
    if (!day || !value) return false
    const [y, m, d] = value.split('-').map(Number)
    return y === viewYear && m - 1 === viewMonth && d === day
  }

  const isToday = (day) => {
    if (!day) return false
    const today = new Date()
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day
  }

  return (
    <>
      {/* Custom Trigger Button */}
      <div className={`flex-1 flex items-center justify-between ${className}`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsOpenCalendar(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpenCalendar(true); } }}
          aria-label={ariaLabel || 'Chọn ngày'}
          className="flex-1 flex items-center justify-between cursor-pointer"
        >
          <span className={`text-sm ${value ? 'text-gray-800' : 'text-gray-400'}`}>
            {value ? formatDateDisplay(value) : 'dd/MM/yyyy'}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0 ml-2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
      </div>

      {/* Calendar Bottom Sheet */}
      {isOpenCalendar && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
            onClick={() => setIsOpenCalendar(false)}
          />

          {/* Calendar Panel */}
          <div className="fixed bottom-0 left-0 w-full bg-white rounded-t-2xl p-5 z-50 shadow-xl animate-slide-up">
            {/* Drag Handle */}
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="text-base font-semibold text-gray-800">
                Tháng {MONTHS[viewMonth]} / {viewYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-2">
              {VIETNAMESE_WEEKDAYS.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <div key={index} className="aspect-square flex items-center justify-center">
                  {day ? (
                    <button
                      type="button"
                      onClick={() => handleDaySelect(day)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                        isSelectedDay(day)
                          ? 'bg-blue-600 text-white shadow-md'
                          : isToday(day)
                          ? 'border-2 border-blue-500 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {day}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Quick Today Button */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  const today = new Date()
                  setViewYear(today.getFullYear())
                  setViewMonth(today.getMonth())
                  onChange(formatDateValue(today.getFullYear(), today.getMonth(), today.getDate()))
                  setIsOpenCalendar(false)
                }}
                className="w-full py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
              >
                Hôm nay
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
