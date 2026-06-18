import { useRef } from 'react'
import { formatDateDisplay } from './FormatDate'

/**
 * Ô chọn ngày: click vào ô → mở calendar trình duyệt.
 * Giá trị lưu là yyyy-mm-dd; ô hiển thị theo dd/MM/yyyy.
 */
export default function DatePicker({ value, onChange, id, required, 'aria-label': ariaLabel, className = '' }) {
  const inputRef = useRef(null)

  const handleBoxClick = () => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    } else {
      input.click()
    }
  }

  return (
    <div className={`relative w-full min-h-[2.5rem] ${className}`}>
      <input
        ref={inputRef}
        type="date"
        id={id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 w-full h-full opacity-0 m-0 p-0 pointer-events-none"
      />
      <div
        role="button"
        tabIndex={0}
        onClick={handleBoxClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBoxClick(); } }}
        aria-label={ariaLabel || 'Chọn ngày'}
        className="absolute inset-0 flex items-center px-3 py-2 rounded-lg bg-white text-ink border border-line cursor-pointer text-sm transition-all duration-150 hover:border-ink-muted/40 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        {value ? formatDateDisplay(value) : <span className="text-ink-muted/60">dd/MM/yyyy</span>}
      </div>
    </div>
  )
}
