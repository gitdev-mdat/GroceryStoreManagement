import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { formatVnd, roundToThousands } from '../FormatNumber'
import { formatVndInputDisplay, parseVndInput } from '../FormatNumber'

const MONTHS_VI = [
  'Tháng 01', 'Tháng 02', 'Tháng 03', 'Tháng 04',
  'Tháng 05', 'Tháng 06', 'Tháng 07', 'Tháng 08',
  'Tháng 09', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

export default function AddMonthlyRevenueForm({ onBack, onNotify, onRefresh }) {
  const { inventory } = useApp()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [groupId, setGroupId] = useState(inventory[0]?.id ?? 'F')
  const [amountRaw, setAmountRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isOpenMonthSheet, setIsOpenMonthSheet] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)

  const monthOptions = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    monthOptions.push({ value: `${y}-${String(m).padStart(2, '0')}`, label: `Tháng ${String(m).padStart(2, '0')}/${y}`, month: m, year: y })
  }

  const selectedGroupName = inventory.find(c => c.id === groupId)?.name ?? 'Bán buôn, bán lẻ'

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

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Chưa kết nối Supabase')
      }

      const saleDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const groupName = selectedGroupName || inventory[0]?.name || 'Bán buôn, bán lẻ'
      const ticketNumber = `S1A-${Date.now().toString(36).toUpperCase()}`

      const { error } = await supabase
        .from('sales_tickets')
        .insert([{
          ticket_number: ticketNumber,
          sale_date: saleDate,
          total_amount: Number(roundToThousands(amount)),
          group_key: groupName,
          notes: 'Nhập nhanh doanh thu tổng cả tháng',
        }])

      if (error) throw error

      setAmountRaw('')
      showToast(`Đã thêm doanh thu tháng ${selectedMonth}/${selectedYear}: ${formatVnd(amount)} VND.`)
      onRefresh?.()
      setTimeout(() => onBack?.(), 1800)
    } catch (err) {
      console.error('Lỗi thêm doanh thu tháng:', err)
      showToast(err.message || 'Không thể lưu doanh thu tháng.', 'error')
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
        <h1 className="text-xl font-bold text-gray-800">Thêm doanh thu tháng</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Nhập nhanh tổng doanh thu bán ra cho cả tháng. Hệ thống sẽ ghi vào ngày mùng 1.
        </p>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4 bg-slate-50">
        {/* Month Selector - Bottom Sheet Trigger */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Tháng</label>
          <button
            type="button"
            onClick={() => setIsOpenMonthSheet(true)}
            className="h-12 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors flex items-center justify-between"
          >
            <span>Tháng {String(selectedMonth).padStart(2, '0')} / {selectedYear}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Group Display */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nhóm hàng hóa</label>
          <div className="h-12 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 flex items-center">
            {selectedGroupName}
          </div>
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
      </form>

      {/* Month Bottom Sheet */}
      {isOpenMonthSheet && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
            onClick={() => setIsOpenMonthSheet(false)}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 w-full bg-white rounded-t-2xl p-5 z-50 shadow-xl animate-slide-up">
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-4">Chọn tháng</h3>
            <div className="max-h-72 overflow-y-auto space-y-0">
              {monthOptions.map((opt, index) => (
                <div key={opt.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonth(opt.month)
                      setSelectedYear(opt.year)
                      setIsOpenMonthSheet(false)
                    }}
                    className={`w-full py-4 px-2 text-left text-sm transition-colors ${selectedMonth === opt.month && selectedYear === opt.year ? 'text-blue-600 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'} ${index < monthOptions.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    {opt.label}
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
          {submitting ? 'Đang lưu...' : 'Thêm doanh thu'}
        </button>
      </div>
    </>
  )
}
