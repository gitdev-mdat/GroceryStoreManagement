import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

export default function CloseBookForm({ onNotify, onRefresh }) {
  const { closedPeriods, setClosedPeriods } = useApp()

  const [closeBookMonth, setCloseBookMonth] = useState(new Date().getMonth() + 1)
  const [closeBookYear, setCloseBookYear] = useState(new Date().getFullYear())
  const [submitting, setSubmitting] = useState(false)

  const handleCloseBook = async () => {
    const ym = `${closeBookYear}-${String(closeBookMonth).padStart(2, '0')}`
    
    if (closedPeriods.includes(ym)) {
      onNotify?.({ type: 'error', text: `Thang ${closeBookMonth}/${closeBookYear} da duoc chot so.` })
      return
    }

    setSubmitting(true)
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Chua ket noi Supabase')
      }

      const { error } = await supabase
        .from('closed_periods')
        .insert([{
          period_month: ym,
        }])

      if (error) throw error

      // Cap nhat local state de ung dung dong bo
      setClosedPeriods([...closedPeriods, ym].sort())
      
      onNotify?.({ type: 'success', text: `Da chot so thang ${closeBookMonth}/${closeBookYear}.` })
      onRefresh?.()
    } catch (err) {
      console.error('Loi chot so:', err)
      onNotify?.({ type: 'error', text: 'Khong the chot so. Vui long thu lai.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <p className="text-sm text-ink-muted mb-4">
        Sau khi chot so, phieu trong ky (thang) do khong the chinh sua hoac xoa.
        Dung khi ket thuc thang/ky de dam bao minh bach voi co quan thue.
      </p>
      <div className="form-row">
        <div className="form-group" style={{ minWidth: '120px' }}>
          <label>Thang</label>
          <select
            value={closeBookMonth}
            onChange={(e) => setCloseBookMonth(Number(e.target.value))}
            disabled={submitting}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>Thang {m}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ minWidth: '110px' }}>
          <label>Nam</label>
          <input
            type="number"
            min={2020}
            max={2030}
            value={closeBookYear}
            onChange={(e) => setCloseBookYear(Number(e.target.value) || new Date().getFullYear())}
            className="input-base"
            disabled={submitting}
          />
        </div>
        <button 
          type="button" 
          className="btn btn-primary" 
          onClick={handleCloseBook}
          disabled={submitting}
        >
          {submitting ? 'Dang chot so...' : 'Chot so thang nay'}
        </button>
      </div>
      <div>
        <strong className="text-sm">Cac ky da chot:</strong>
        {closedPeriods.length === 0 ? (
          <p className="text-sm text-ink-muted mt-1">Chua chot ky nao.</p>
        ) : (
          <ul className="mt-1 pl-5">
            {closedPeriods.map((ym) => {
              const [y, m] = ym.split('-')
              return <li key={ym} className="text-sm">Thang {Number(m)}/{y}</li>
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
