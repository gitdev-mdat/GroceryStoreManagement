import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { formatVnd, roundToThousands } from '../FormatNumber'
import { formatVndInputDisplay, parseVndInput } from '../FormatNumber'
import DatePicker from '../DatePicker'

const INDUSTRY_GROUPS = [
  { id: 'do-dung-gia-dinh', label: 'Nhóm Đồ dùng gia đình & Tiện ích' },
  { id: 'hoa-my-pham', label: 'Nhóm Hóa mỹ phẩm & Tẩy rửa' },
  { id: 'thuc-pham-dong-goi', label: 'Nhóm Thực phẩm đóng gói & Đồ uống' },
]

export default function AddTicketForm({ onBack, onNotify, onRefresh }) {
  const { isPeriodClosed } = useApp()

  const [date, setDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [groupId, setGroupId] = useState('do-dung-gia-dinh')
  const [amountRaw, setAmountRaw] = useState('')
  const [dienGiai, setDienGiai] = useState('')
  const [isOpenGroupSheet, setIsOpenGroupSheet] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)

  const selectedGroup = INDUSTRY_GROUPS.find(g => g.id === groupId)
  const groupName = selectedGroup?.label ?? groupId

  useEffect(() => {
    setDienGiai(`Bán lẻ ${groupName} cho khách hàng cá nhân`)
  }, [groupId, groupName])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }

  const handleAmountChange = (e) => {
    setAmountRaw(e.target.value)
    if (errors.amount) setErrors(prev => ({ ...prev, amount: null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amount = parseVndInput(amountRaw)
    const newErrors = {}

    if (!amountRaw || amount <= 0) {
      newErrors.amount = 'Vui lòng nhập số tiền doanh thu'
    }
    if (!date) {
      newErrors.date = 'Vui lòng chọn ngày'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    if (isPeriodClosed?.(date)) {
      showToast('Kỳ này đã chốt sổ, không thể thêm phiếu.', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Chưa kết nối Supabase')
      }

      const ticketNumber = `S1A-${Date.now().toString(36).toUpperCase()}`

      const { error } = await supabase
        .from('sales_tickets')
        .insert([{
          ticket_number: ticketNumber,
          sale_date: date,
          total_amount: Number(roundToThousands(amount)),
          group_key: groupName,
          notes: dienGiai || `Bán lẻ ${groupName} cho khách hàng cá nhân`,
        }])

      if (error) throw error

      setAmountRaw('')
      setDienGiai('')
      showToast(`Đã thêm phiếu ${formatVnd(amount)} VND.`)
      onRefresh?.()
      setTimeout(() => onBack?.(), 1800)
    } catch (err) {
      console.error('Lỗi thêm phiếu S1A:', err)
      showToast(err.message || 'Không thể thêm phiếu.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium mb-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Quay lại</span>
        </button>
        <h1 className="text-xl font-bold text-gray-800">Thêm phiếu doanh thu</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Nhập doanh thu cho một ngày cụ thể và một nhóm hàng.
        </p>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 bg-slate-50">
        {/* Date Picker */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Ngày</label>
          <div className={`h-12 px-4 bg-white border rounded-xl flex items-center justify-between ${errors.date ? 'border-red-500' : 'border-gray-200'}`}>
            <DatePicker
              value={date}
              onChange={(val) => {
                setDate(val)
                if (errors.date) setErrors(prev => ({ ...prev, date: null }))
              }}
              aria-label="Chọn ngày"
              className="!static"
            />
          </div>
          {errors.date && <span className="text-xs text-red-500 mt-1">{errors.date}</span>}
        </div>

        {/* Industry Group Selector */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nhóm ngành hàng</label>
          <button
            type="button"
            onClick={() => setIsOpenGroupSheet(true)}
            className="h-12 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors flex items-center justify-between"
          >
            <span>{groupName}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Amount Input */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Số tiền (VND)</label>
          <input
            type="text"
            inputMode="numeric"
            value={amountRaw}
            onChange={handleAmountChange}
            placeholder="0"
            className={`h-12 py-3 px-4 bg-white border rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 transition-colors tabular-nums ${errors.amount ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500'}`}
          />
          {errors.amount && <span className="text-xs text-red-500 mt-1">{errors.amount}</span>}
        </div>

        {/* Notes */}
        <div className="flex flex-col mb-20">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Diễn giải</label>
          <textarea
            rows={3}
            value={dienGiai}
            onChange={(e) => setDienGiai(e.target.value)}
            placeholder="Nhập diễn giải..."
            className="py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
          />
        </div>
      </form>

      {/* Industry Group Bottom Sheet */}
      {isOpenGroupSheet && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/40 z-40 animate-fade-in" onClick={() => setIsOpenGroupSheet(false)} />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 w-full bg-white rounded-t-2xl p-5 z-50 shadow-xl animate-slide-up max-h-[70vh] overflow-hidden flex flex-col">
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4 flex-shrink-0" />
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-4 flex-shrink-0">Chọn nhóm hàng hóa</h3>
            <div className="overflow-y-auto space-y-0 flex-1 min-h-0">
              {INDUSTRY_GROUPS.map((group, index) => (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => { setGroupId(group.id); setIsOpenGroupSheet(false) }}
                    className={`w-full py-4 px-2 text-left text-sm transition-colors ${groupId === group.id ? 'text-blue-600 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'} ${index < INDUSTRY_GROUPS.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    {group.label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-slide-down ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'success' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Sticky Bottom Button */}
      <div className="fixed bottom-0 left-0 w-full bg-white p-4 border-t border-gray-100 z-10">
        <button
          type="submit"
          onClick={handleSubmit}
          className="w-full h-12 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Đang lưu...' : 'Thêm phiếu'}
        </button>
      </div>
    </>
  )
}
