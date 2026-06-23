import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { formatVnd } from '../FormatNumber'
import { formatDateDisplay } from '../FormatDate'
import { ArrowLeft, ChevronDown, ChevronRight, ChevronLeft, ReceiptText, Pencil, Trash2, Loader2, AlertTriangle, X } from 'lucide-react'

/* ─────────────────────────────────────────────
   Edit Modal — inline edit via popover
───────────────────────────────────────────── */
function EditTicketModal({ ticket, onClose, onSave, onDeleteRequest, isSaving }) {
  const [date, setDate] = useState(ticket.sale_date || '')
  const [amountRaw, setAmountRaw] = useState(String(ticket.total_amount || ''))
  const [amountDisplay, setAmountDisplay] = useState(
    ticket.total_amount ? Number(ticket.total_amount).toLocaleString('vi-VN') : ''
  )
  const [dienGiai, setDienGiai] = useState(ticket.notes || '')
  const [errors, setErrors] = useState({})

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    setAmountRaw(raw)
    setAmountDisplay(raw ? Number(raw).toLocaleString('vi-VN') : '')
    if (errors.amount) setErrors(prev => ({ ...prev, amount: null }))
  }

  const handleAmountBlur = () => { }

  const handleSave = () => {
    const amount = Number(amountRaw)
    const newErrors = {}
    if (!amountRaw || amount <= 0) newErrors.amount = 'Vui lòng nhập số tiền hợp lệ'
    if (!date) newErrors.date = 'Vui lòng chọn ngày'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    onSave({ ...ticket, sale_date: date, total_amount: amount, notes: dienGiai })
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="
        fixed left-1/2 top-1/2 z-50 flex flex-col w-[calc(100%-32px)] max-w-sm mx-auto
        -translate-x-1/2 -translate-y-1/2
        rounded-2xl border border-slate-200 bg-white p-6
        shadow-[0_24px_64px_-12px_rgba(15,23,42,0.25)]
      " style={{ animation: 'modal-pop 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Sửa phiếu doanh thu</h3>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Ticket number badge and Delete link */}
        <div className="mb-5 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Mã phiếu:</span>
            <span className="text-xs font-bold text-slate-700">{ticket.ticket_number || '—'}</span>
          </div>
          <button
            type="button"
            onClick={onDeleteRequest}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none"
          >
            <Trash2 size={14} strokeWidth={2.5} />
            <span>Xóa phiếu</span>
          </button>
        </div>

        {/* Date field */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ngày ghi nhận
          </label>
          <div className="relative w-full">
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); if (errors.date) setErrors(prev => ({ ...prev, date: null })) }}
              className={`
                w-full text-base border border-slate-200 rounded-xl p-3 bg-white
                focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100
                ${errors.date ? 'border-red-300 ring-2 ring-red-100' : 'hover:border-slate-300'}
              `}
            />
          </div>
          {errors.date && <p className="mt-1 text-xs font-medium text-red-500">{errors.date}</p>}
        </div>

        {/* Amount field */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Số tiền doanh thu
          </label>
          <div className={`
            relative flex items-center overflow-hidden rounded-xl border bg-slate-50 transition-all duration-150
            focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100
            ${errors.amount ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200 hover:border-slate-300'}
          `}>
            <input
              type="text"
              inputMode="numeric"
              value={amountDisplay}
              onChange={handleAmountChange}
              onBlur={handleAmountBlur}
              placeholder="0"
              className="
                h-[42px] min-w-0 flex-1 bg-transparent
                pl-3.5 pr-10 text-left
                text-base font-normal tabular-nums tracking-tight text-slate-900
                placeholder:font-normal placeholder:text-slate-300
                focus:outline-none
              "
            />
            <span className="pointer-events-none absolute right-3.5 select-none text-sm font-semibold text-slate-400">đ</span>
          </div>
          {errors.amount && <p className="mt-1 text-xs font-medium text-red-500">{errors.amount}</p>}
        </div>

        {/* Description field */}
        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Diễn giải</label>
          <textarea
            rows={3}
            value={dienGiai}
            onChange={(e) => setDienGiai(e.target.value)}
            placeholder="Nhập diễn giải..."
            className="
              w-full resize-none rounded-xl border border-slate-200 bg-slate-50
              px-3.5 py-3 text-sm leading-relaxed text-slate-800
              placeholder:text-slate-300 transition-all duration-150
              hover:border-slate-300 hover:bg-white
              focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100
            "
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {/* Cancel button */}
          <button
            type="button"
            onClick={onClose}
            className="
              flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5
              text-sm font-semibold text-slate-600
              transition-all duration-150
              hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800
              focus:outline-none focus:ring-2 focus:ring-brand-100
            "
          >
            Hủy bỏ
          </button>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="
              flex min-h-[44px] flex-1 items-center justify-center gap-2
              rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-2.5
              text-sm font-semibold text-white
              shadow-[0_4px_16px_-2px_rgba(37,99,235,0.35)]
              transition-all duration-200
              hover:-translate-y-px hover:shadow-[0_6px_20px_-2px_rgba(37,99,235,0.45)]
              active:scale-[0.98]
              disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0
              focus:outline-none focus:ring-2 focus:ring-brand-300
            "
          >
            {isSaving ? <Loader2 size={16} strokeWidth={2} className="animate-spin" /> : null}
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modal-pop {
          from { opacity: 0; transform: translateX(-50%) translateY(-48%) scale(0.94); }
          to   { opacity: 1; transform: translateX(-50%) translateY(-50%) scale(1); }
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.6;
        }
      `}</style>
    </>
  )
}

/* ─────────────────────────────────────────────
   Delete Confirmation Modal
───────────────────────────────────────────── */
function DeleteConfirmModal({ ticketId, onCancel, onConfirm, isDeleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        style={{ animation: 'confirm-fade-in 0.18s ease' }}
        onClick={onCancel}
      />

      {/* Modal card */}
      <div className="
        relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white
        shadow-[0_24px_64px_-12px_rgba(15,23,42,0.25)]
      " style={{ animation: 'confirm-pop 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* Inner padding */}
        <div className="p-6">
          {/* Header: icon + title */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle size={20} strokeWidth={2} className="text-rose-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa phiếu</h3>
          </div>

          {/* Content */}
          <p className="mb-6 text-sm leading-relaxed text-slate-600">
            Bạn có chắc chắn muốn xóa phiếu doanh thu này không? Hành động này sẽ xóa vĩnh viễn dữ liệu và không thể hoàn tác.
          </p>

          {/* Footer buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="
                flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5
                text-sm font-semibold text-slate-600
                transition-all duration-150
                hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800
                disabled:cursor-not-allowed disabled:opacity-50
                focus:outline-none focus:ring-2 focus:ring-brand-100
              "
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="
                flex-1 min-h-[44px] rounded-xl bg-rose-600 px-4 py-2.5
                text-sm font-semibold text-white
                shadow-[0_4px_14px_-2px_rgba(225,29,72,0.35)]
                transition-all duration-150
                hover:bg-rose-700 hover:-translate-y-px hover:shadow-[0_6px_18px_-2px_rgba(225,29,72,0.4)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0
                focus:outline-none focus:ring-2 focus:ring-rose-300
              "
            >
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                  Đang xóa...
                </span>
              ) : 'Xác nhận xóa'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes confirm-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes confirm-pop {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Skeleton loader
───────────────────────────────────────────── */
function CardSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 rounded-md bg-slate-200" />
            <div className="h-4 w-20 rounded-md bg-slate-200" />
          </div>
          <div className="mt-2 h-3 w-36 rounded-md bg-slate-100" />
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="h-3 w-full rounded-md bg-slate-100" />
          </div>
        </div>
      ))}
    </>
  )
}

/* ─────────────────────────────────────────────
   Main component — data logic UNCHANGED
───────────────────────────────────────────── */
export default function S1AList({ onBack, onNotify, onRefresh, onEdit }) {
  const [loading, setLoading] = useState(false)
  const [allTickets, setAllTickets] = useState([])
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [availableMonths, setAvailableMonths] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isMonthOpen, setIsMonthOpen] = useState(false)

  // ── Edit / Delete state ──
  const [editingTicket, setEditingTicket] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  const pageSize = 10

  // ── Edit action: open modal with ticket data ──
  const handleEdit = useCallback((ticket) => {
    setEditingTicket(ticket)
  }, [])

  // ── Save edited ticket via Supabase fetch ──
  const handleSaveEdit = useCallback(async (updatedTicket) => {
    if (!isSupabaseConfigured()) {
      onNotify?.({ type: 'error', text: 'Chưa kết nối Supabase.' })
      return
    }
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('sales_tickets')
        .update({
          sale_date: updatedTicket.sale_date,
          total_amount: Number(updatedTicket.total_amount),
          notes: updatedTicket.notes,
        })
        .eq('id', updatedTicket.id)

      if (error) throw error

      // Optimistic update: replace ticket in local state
      setAllTickets(prev =>
        prev.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t)
      )
      setEditingTicket(null)
      setToast({ show: true, message: 'Cập nhật phiếu doanh thu thành công!', type: 'success' })
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
      onRefresh?.()
    } catch (err) {
      console.error('Lỗi cập nhật phiếu:', err)
      setToast({ show: true, message: 'Cập nhật thất bại. Vui lòng thử lại.', type: 'error' })
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
    } finally {
      setIsSaving(false)
    }
  }, [onNotify, onRefresh])

  // ── Delete: open confirmation modal ──
  const handleDelete = useCallback((ticketId) => {
    setPendingDeleteId(ticketId)
    setIsDeleteModalOpen(true)
  }, [])

  // ── Confirm & execute real Supabase DELETE ──
  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    if (!isSupabaseConfigured()) {
      setIsDeleteModalOpen(false)
      onNotify?.({ type: 'error', text: 'Chưa kết nối Supabase.' })
      return
    }
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('sales_tickets')
        .delete()
        .eq('id', pendingDeleteId)

      if (error) throw error

      setAllTickets(prev => prev.filter(t => t.id !== pendingDeleteId))
      setIsDeleteModalOpen(false)
      setPendingDeleteId(null)
      setEditingTicket(null)
      setToast({ show: true, message: 'Xóa phiếu doanh thu thành công!', type: 'success' })
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
      onRefresh?.()
    } catch (err) {
      console.error('Lỗi xóa phiếu:', err)
      setIsDeleteModalOpen(false)
      setToast({ show: true, message: 'Xóa phiếu thất bại. Vui lòng thử lại.', type: 'error' })
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
    } finally {
      setIsDeleting(false)
    }
  }, [pendingDeleteId, onNotify, onRefresh])
  const fetchAvailableMonths = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setAvailableMonths([])
      return
    }
    try {
      const { data, error } = await supabase.from('sales_tickets').select('sale_date')
      if (error) throw error

      if (!data || data.length === 0) {
        const now = new Date()
        const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        setAvailableMonths([current])
        return
      }

      const monthSet = new Set()
      data.forEach((item) => {
        if (item.sale_date) {
          const date = new Date(item.sale_date)
          const y = date.getFullYear()
          const m = String(date.getMonth() + 1).padStart(2, '0')
          monthSet.add(`${y}-${m}`)
        }
      })

      const months = Array.from(monthSet).sort((a, b) => b.localeCompare(a))
      setAvailableMonths(months)
    } catch (err) {
      console.error('Loi fetch available months:', err)
      const now = new Date()
      const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      setAvailableMonths([current])
    }
  }, [])

  // Fetch S1A data by month
  const fetchS1AData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sales_tickets')
        .select('*')
        .order('sale_date', { ascending: false })

      if (error) throw error
      setAllTickets(data || [])
    } catch (err) {
      console.error('Loi fetch du lieu S1A:', err)
      onNotify?.({ type: 'error', text: 'Khong the tai du lieu tu Supabase.' })
      setAllTickets([])
    } finally {
      setLoading(false)
    }
  }, [onNotify])

  useEffect(() => { fetchS1AData() }, [fetchS1AData, filterMonth])
  useEffect(() => { fetchAvailableMonths() }, [fetchAvailableMonths])

  useEffect(() => {
    if (availableMonths.length > 0) {
      if (!availableMonths.includes(filterMonth)) setFilterMonth(availableMonths[0])
    } else {
      const now = new Date()
      const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      if (filterMonth !== current) setFilterMonth(current)
    }
  }, [availableMonths, filterMonth])

  // Filter by month
  const monthRows = useMemo(() => {
    const [year, month] = filterMonth.split('-')
    return allTickets
      .filter((ticket) => {
        if (!ticket.sale_date) return false
        const ticketYear = ticket.sale_date.slice(0, 4)
        const ticketMonth = ticket.sale_date.slice(5, 7)
        return ticketYear === year && ticketMonth === month
      })
      .sort((a, b) => (b.sale_date || '').localeCompare(a.sale_date || ''))
  }, [allTickets, filterMonth])

  const totalTickets = monthRows.length
  const totalAmount = monthRows.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0)

  const totalPages = Math.max(1, Math.ceil(totalTickets / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedRows = monthRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => { setCurrentPage(1) }, [filterMonth])

  /* ── Helpers ── */
  const formatMonthLabel = (m) => {
    const [y, mo] = m.split('-')
    return `Tháng ${mo}/${y}`
  }

  /* ──────────────────────────────────────────
     Render
  ────────────────────────────────────────── */
  return (
    <div className="mx-auto w-full max-w-[640px] px-0 pb-16">

      {/* ══════════════════════════════════════
          Back button
      ══════════════════════════════════════ */}
      <button
        type="button"
        onClick={onBack}
        className="
          mb-6 inline-flex items-center gap-2
          rounded-lg border border-slate-200 bg-white
          px-3.5 py-2 text-sm font-medium text-slate-500
          shadow-sm transition-all duration-150
          hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700
          focus:outline-none focus:ring-2 focus:ring-brand-100
        "
      >
        <ArrowLeft size={15} strokeWidth={2.25} />
        Quay lại
      </button>

      {/* ══════════════════════════════════════
          Page header
      ══════════════════════════════════════ */}
      <div className="mb-6 flex items-start gap-4">
        <div className="
          flex h-12 w-12 shrink-0 items-center justify-center
          rounded-xl border border-brand-100 bg-brand-50
          shadow-[0_0_0_4px_rgba(37,99,235,0.06)]
        ">
          <ReceiptText size={22} strokeWidth={1.75} className="text-brand-600" />
        </div>
        <div className="pt-0.5">
          <h2 className="m-0 text-xl font-bold leading-snug text-slate-900">
            Danh sách phiếu
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Xem và quản lý các phiếu doanh thu
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════
          Stats + Filter bar
      ══════════════════════════════════════ */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.07)]">

        {/* Stats row */}
        <div className="flex divide-x divide-slate-100">
          {/* Stat: Số phiếu */}
          <div className="flex flex-1 flex-col gap-0.5 px-5 py-4">
            <span className="tabular-nums text-2xl font-bold leading-none text-slate-900">
              {totalTickets}
            </span>
            <span className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Phiếu phát sinh
            </span>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-slate-100" />

          {/* Stat: Tổng doanh thu */}
          <div className="flex flex-1 flex-col gap-0.5 px-5 py-4">
            <span className="tabular-nums text-2xl font-bold leading-none text-emerald-600">
              {formatVnd(totalAmount)}
              <span className="ml-1 text-sm font-semibold text-emerald-500">đ</span>
            </span>
            <span className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Tổng doanh thu
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <div className="relative inline-block">
            {/* Custom dropdown trigger */}
            <button
              type="button"
              onClick={() => setIsMonthOpen(o => !o)}
              className="
                inline-flex items-center gap-2
                rounded-lg border border-slate-200 bg-white
                px-3.5 py-2 text-sm font-semibold text-slate-700
                shadow-sm transition-all duration-150
                hover:border-slate-300 hover:bg-slate-50
                focus:outline-none focus:ring-2 focus:ring-brand-100
              "
            >
              {formatMonthLabel(filterMonth)}
              <ChevronDown
                size={14}
                strokeWidth={2.5}
                className={`text-slate-400 transition-transform duration-200 ${isMonthOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown panel */}
            {isMonthOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMonthOpen(false)}
                />
                <div className="
                  absolute left-0 top-full z-20 mt-1.5
                  min-w-[160px] overflow-hidden rounded-xl
                  border border-slate-200 bg-white py-1
                  shadow-[0_8px_24px_-4px_rgba(15,23,42,0.14)]
                ">
                  {availableMonths.map((month) => (
                    <button
                      key={month}
                      type="button"
                      onClick={() => { setFilterMonth(month); setIsMonthOpen(false) }}
                      className={`
                        flex w-full items-center justify-between px-4 py-2.5 text-sm
                        transition-colors duration-100
                        ${month === filterMonth
                          ? 'bg-brand-50 font-semibold text-brand-700'
                          : 'font-medium text-slate-700 hover:bg-slate-50'
                        }
                      `}
                    >
                      {formatMonthLabel(month)}
                      {month === filterMonth && (
                        <div className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          Loading
      ══════════════════════════════════════ */}
      {loading && (
        <div className="flex flex-col gap-2">
          <CardSkeleton />
        </div>
      )}

      {/* ══════════════════════════════════════
          Empty state
      ══════════════════════════════════════ */}
      {!loading && monthRows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <ReceiptText size={22} strokeWidth={1.5} className="text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-600">Không có phiếu nào</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {isSupabaseConfigured()
                ? 'Chưa có dữ liệu trong kỳ này.'
                : 'Chưa kết nối Supabase.'}
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          Card list
      ══════════════════════════════════════ */}
      {!loading && monthRows.length > 0 && (
        <div className="flex flex-col gap-2">

          {paginatedRows.map((ticket) => (
            <div
              key={ticket.id}
              className="
                group relative rounded-2xl border border-slate-200 bg-white
                px-4 py-4
                shadow-[0_1px_4px_rgba(15,23,42,0.05)]
              "
            >
              {/* ── Top row: Date | Amount | Actions ── */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-800">
                  {formatDateDisplay(ticket.sale_date)}
                </span>

                {/* Right side: amount + action icons */}
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-sm font-bold text-emerald-600 whitespace-nowrap">
                    {formatVnd(ticket.total_amount)}
                    <span className="ml-0.5 text-xs font-semibold text-emerald-500">đ</span>
                  </span>

                  {/* ── Action icons container ── */}
                  <div className="flex items-center gap-1">
                    {/* Edit button */}
                    <button
                      type="button"
                      title="Sửa phiếu"
                      onClick={() => handleEdit(ticket)}
                      className="
                        flex h-8 w-8 items-center justify-center rounded-lg
                        text-slate-300 transition-all duration-150
                        hover:scale-110 hover:text-brand-600 hover:bg-brand-50
                        focus:outline-none focus:ring-2 focus:ring-brand-200
                      "
                    >
                      <Pencil size={15} strokeWidth={2} />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      title="Xóa phiếu"
                      onClick={() => handleDelete(ticket.id)}
                      disabled={isDeleting}
                      className="
                        flex h-8 w-8 items-center justify-center rounded-lg
                        text-slate-300 transition-all duration-150
                        hover:scale-110 hover:text-red-500 hover:bg-red-50
                        focus:outline-none focus:ring-2 focus:ring-red-200
                        disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100
                      "
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Sub-row: ticket ID ── */}
              <p className="mt-0.5 text-[11px] font-medium tracking-wide text-slate-400">
                Mã phiếu: {ticket.ticket_number || '—'}
              </p>

              {/* ── Divider ── */}
              <div className="my-3 h-px bg-slate-100" />

              {/* ── Description ── */}
              <p className="text-sm leading-relaxed text-slate-600 break-words">
                {ticket.notes || '—'}
              </p>
            </div>
          ))}

          {/* ══════════════════════════════════════
              Pagination — always visible when data exists
          ══════════════════════════════════════ */}
          <div className="mt-3 flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.05)]">

            {/* Prev button */}
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="
                flex h-12 items-center gap-2 pl-4 pr-5
                text-sm font-semibold text-slate-600
                border-r border-slate-100
                transition-colors duration-150
                hover:bg-slate-50
                disabled:cursor-not-allowed disabled:opacity-30
                focus:outline-none
              "
            >
              <ChevronLeft size={16} strokeWidth={2.25} />
              Trước
            </button>

            {/* Page indicator */}
            <div className="flex flex-1 items-center justify-center gap-1.5">
              <span className="tabular-nums text-xs font-semibold text-slate-400">
                Trang
              </span>
              <span className="tabular-nums text-sm font-bold text-slate-800">
                {safePage}
              </span>
              <span className="text-xs text-slate-300">/</span>
              <span className="tabular-nums text-sm font-semibold text-slate-500">
                {totalPages}
              </span>
            </div>

            {/* Next button */}
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="
                flex h-12 items-center gap-2 pl-5 pr-4
                text-sm font-semibold text-slate-600
                border-l border-slate-100
                transition-colors duration-150
                hover:bg-slate-50
                disabled:cursor-not-allowed disabled:opacity-30
                focus:outline-none
              "
            >
              Sau
              <ChevronRight size={16} strokeWidth={2.25} />
            </button>
          </div>

        </div>
      )}
      {/* ══════════════════════════════════════
          Edit modal
      ══════════════════════════════════════ */}
      {editingTicket && (
        <EditTicketModal
          ticket={editingTicket}
          onClose={() => setEditingTicket(null)}
          onSave={handleSaveEdit}
          onDeleteRequest={() => handleDelete(editingTicket.id)}
          isSaving={isSaving}
        />
      )}

      {/* ══════════════════════════════════════
          Delete confirmation modal
      ══════════════════════════════════════ */}
      {isDeleteModalOpen && (
        <DeleteConfirmModal
          ticketId={pendingDeleteId}
          onCancel={() => { setIsDeleteModalOpen(false); setPendingDeleteId(null) }}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
        />
      )}

      {/* ══════════════════════════════════════
          Toast Notification
      ══════════════════════════════════════ */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 z-[60] -translate-x-1/2" style={{ animation: 'toast-slide-down 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div className={`
            px-5 py-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] font-medium text-sm text-white whitespace-nowrap
            ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}
          `}>
            {toast.message}
          </div>
        </div>
      )}

      <style>{`
        @keyframes toast-slide-down {
          from { opacity: 0; transform: translate(-50%, -20px) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>
    </div>
  )
}
