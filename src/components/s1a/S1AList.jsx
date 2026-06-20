import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { formatVnd } from '../FormatNumber'
import { formatDateDisplay } from '../FormatDate'
import { ArrowLeft, ChevronDown, ChevronRight, ChevronLeft, ReceiptText } from 'lucide-react'

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
export default function S1AList({ onBack, onNotify, onRefresh }) {
  const [loading, setLoading] = useState(false)
  const [allTickets, setAllTickets] = useState([])
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [availableMonths, setAvailableMonths] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isMonthOpen, setIsMonthOpen] = useState(false)
  const pageSize = 10

  // Fetch distinct months from sales_tickets
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
                rounded-2xl border border-slate-200 bg-white
                px-4 py-4
                shadow-[0_1px_4px_rgba(15,23,42,0.05)]
              "
            >
              {/* ── Top row: Date | Amount ── */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-800">
                  {formatDateDisplay(ticket.sale_date)}
                </span>
                <span className="tabular-nums text-sm font-bold text-emerald-600 whitespace-nowrap">
                  {formatVnd(ticket.total_amount)}
                  <span className="ml-0.5 text-xs font-semibold text-emerald-500">đ</span>
                </span>
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
    </div>
  )
}
