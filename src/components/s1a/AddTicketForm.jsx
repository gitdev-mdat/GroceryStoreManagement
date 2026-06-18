import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { formatVnd, roundToThousands } from '../FormatNumber'
import VndInput from '../VndInput'
import { formatDateForInput, formatDateDisplay } from '../FormatDate'
import DatePicker from '../DatePicker'

const INPUT_CLASS =
  'w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm'

export default function AddTicketForm({ onNotify, onRefresh }) {
  const { inventory, isPeriodClosed } = useApp()

  const [date, setDate] = useState(formatDateForInput(new Date()))
  const [groupKey, setGroupKey] = useState(inventory[0]?.id ?? '')
  const [amount, setAmount] = useState(0)
  const [dienGiai, setDienGiai] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const selectedGroupId = groupKey || inventory[0]?.id
  const groupName = inventory.find((c) => c.id === selectedGroupId)?.name ?? selectedGroupId

  useEffect(() => {
    const autoText = `Bán lẻ ${groupName} cho khách hàng cá nhân`
    setDienGiai(autoText)
  }, [selectedGroupId, groupName])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!date || amount <= 0) return
    if (isPeriodClosed(date)) {
      onNotify?.({ type: 'error', text: 'Kỳ này đã chốt sổ, không thể thêm hoặc sửa phiếu.' })
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

      setAmount(0)
      setDate(formatDateForInput(new Date()))
      setDienGiai('')
      setEditingId(null)
      onNotify?.({ type: 'success', text: `Đã thêm phiếu doanh thu ${formatVnd(amount)} VND.` })
      onRefresh?.()
    } catch (err) {
      console.error('Lỗi thêm phiếu S1A:', err)
      onNotify?.({ type: 'error', text: 'Không thể thêm phiếu. Vui lòng thử lại.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card p-6">
      <p className="text-sm text-ink-muted mb-4">
        Nhập doanh thu cho <strong>một ngày cụ thể</strong> và <strong>một nhóm hàng</strong>.
        Diễn giải sẽ tự động sinh dựa trên nhóm hàng được chọn.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full">
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Ngày</label>
            <DatePicker
              value={date}
              onChange={setDate}
              required
              aria-label="Chọn ngày"
            />
          </div>
          <div className="md:col-span-6">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Nhóm hàng hóa</label>
            <select
              value={groupKey || inventory[0]?.id}
              onChange={(e) => setGroupKey(e.target.value)}
              className={INPUT_CLASS}
            >
              {inventory.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Số tiền (VND)</label>
            <VndInput
              value={amount}
              onChange={setAmount}
              placeholder="7.000.000"
              required
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 mb-1 block">Diễn giải</label>
          <input
            type="text"
            value={dienGiai}
            onChange={(e) => setDienGiai(e.target.value)}
            className={`${INPUT_CLASS} mt-1`}
            placeholder="Nhập diễn giải..."
          />
        </div>

        <div className="mt-6">
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-all shadow-md active:scale-95"
            disabled={submitting}
          >
            {submitting ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Thêm phiếu')}
          </button>
          {editingId && (
            <button
              type="button"
              className="ml-3 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-all hover:bg-slate-50"
              onClick={() => setEditingId(null)}
            >
              Hủy
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
