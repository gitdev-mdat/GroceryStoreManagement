import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { formatVnd, roundToThousands } from '../FormatNumber'
import VndInput from '../VndInput'

const INPUT_CLASS =
  'w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm'

export default function AddMonthlyRevenueForm({ onNotify, onRefresh }) {
  const { inventory } = useApp()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [groupId, setGroupId] = useState(inventory[0]?.id ?? '')
  const [amount, setAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const monthOptions = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    monthOptions.push({
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: `Tháng ${String(m).padStart(2, '0')}/${y}`,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (amount <= 0) {
      onNotify?.({ type: 'error', text: 'Vui lòng nhập số tiền lớn hơn 0.' })
      return
    }

    setSubmitting(true)
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Chưa kết nối Supabase')
      }

      const saleDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const groupName = inventory.find((c) => c.id === groupId)?.name ?? groupId
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

      setAmount(0)
      onNotify?.({
        type: 'success',
        text: `Đã thêm doanh thu tháng ${selectedMonth}/${selectedYear}: ${formatVnd(amount)} VND.`,
      })
      onRefresh?.()
    } catch (err) {
      console.error('Lỗi thêm doanh thu tháng:', err)
      onNotify?.({ type: 'error', text: 'Không thể lưu doanh thu tháng. Vui lòng thử lại.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card p-6">
      <p className="text-sm text-ink-muted mb-4">
        Nhập nhanh tổng doanh thu bán ra cho cả tháng theo từng nhóm hàng hóa.
        Hệ thống sẽ tự động ghi sổ vào ngày mùng 1 của tháng được chọn.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full">
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Chọn Tháng/Năm</label>
            <select
              value={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-')
                setSelectedYear(Number(y))
                setSelectedMonth(Number(m))
              }}
              className={INPUT_CLASS}
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-5">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Nhóm hàng hóa</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={INPUT_CLASS}
            >
              {inventory.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Số tiền tổng cả tháng (VND)</label>
            <VndInput
              value={amount}
              onChange={setAmount}
              placeholder="7.000.000"
              required
              className={INPUT_CLASS}
            />
          </div>
        < /div>

        <div className="mt-5">
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-all shadow-md active:scale-95"
            disabled={submitting}
          >
            {submitting ? 'Đang lưu...' : 'Thêm doanh thu'}
          </button>
        </div>
      </form>
    </div>
  )
}
