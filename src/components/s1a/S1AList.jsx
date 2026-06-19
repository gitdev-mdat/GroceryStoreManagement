import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { formatVnd } from '../FormatNumber'
import { formatDateDisplay } from '../FormatDate'

// Skeleton Component
function CardSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 bg-white border border-gray-100 rounded-xl">
          <div className="flex justify-between items-center">
            <div className="h-5 w-28 rounded bg-slate-200 animate-pulse" />
            <div className="h-5 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="h-3 w-40 rounded bg-slate-200 animate-pulse mt-2" />
          <div className="h-4 w-full rounded bg-slate-200 animate-pulse mt-3 pt-2 border-t border-gray-50" />
        </div>
      ))}
    </>
  )
}

export default function S1AList({ onBack, onNotify, onRefresh }) {
  const [loading, setLoading] = useState(false)
  const [allTickets, setAllTickets] = useState([])
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [availableMonths, setAvailableMonths] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Fetch distinct months from sales_tickets
  const fetchAvailableMonths = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setAvailableMonths([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('sales_tickets')
        .select('sale_date')

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

  // Reload data when filterMonth changes
  useEffect(() => {
    fetchS1AData()
  }, [fetchS1AData, filterMonth])

  // Load available months on mount
  useEffect(() => {
    fetchAvailableMonths()
  }, [fetchAvailableMonths])

  // Sync filterMonth with available months
  useEffect(() => {
    if (availableMonths.length > 0) {
      if (!availableMonths.includes(filterMonth)) {
        setFilterMonth(availableMonths[0])
      }
    } else {
      const now = new Date()
      const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      if (filterMonth !== current) {
        setFilterMonth(current)
      }
    }
  }, [availableMonths, filterMonth])

  // Filter theo thang, khong gom nhom theo ngay
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
  const totalAmount = monthRows.reduce((sum, ticket) => sum + (Number(ticket.total_amount) || 0), 0)

  // Paginated rows
  const totalPages = Math.max(1, Math.ceil(totalTickets / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedRows = monthRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  // Reset to page 1 when filter changes
  useEffect(() => { setCurrentPage(1) }, [filterMonth])

  return (
    <div className="sub-page">
      {/* Header */}
      <div className="sub-page-header">
        <button type="button" className="back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại
        </button>
        <div className="sub-page-title">
          <h2 className="text-xl font-bold text-gray-800">Danh sách phiếu</h2>
          <p className="sub-page-subtitle">Xem và quản lý các phiếu doanh thu</p>
        </div>
      </div>

      {/* Content */}
      <div className="sub-page-content bg-slate-50">
        {/* Stats Row */}
        <div className="mini-stats-row">
          <div className="mini-stat">
            <span className="mini-stat-value">{totalTickets}</span>
            <span className="mini-stat-label">Phiếu phát sinh</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-value text-emerald">{formatVnd(totalAmount)}</span>
            <span className="mini-stat-label">Tổng doanh thu</span>
          </div>
        </div>

        {/* Filter */}
        <div className="filter-bar">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="filter-select"
          >
            {availableMonths.map((month) => {
              const [y, m] = month.split('-')
              return (
                <option key={month} value={month}>
                  Tháng {m}/{y}
                </option>
              )
            })}
          </select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col gap-3">
            <CardSkeleton />
          </div>
        )}

        {/* Empty State */}
        {!loading && monthRows.length === 0 && (
          <div className="text-center text-slate-400 py-8 text-sm">
            {isSupabaseConfigured() ? 'Không có dữ liệu trong kỳ này.' : 'Chưa kết nối Supabase.'}
          </div>
        )}

        {/* Card List */}
        {!loading && monthRows.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* Ticket Cards */}
            {paginatedRows.map((ticket) => (
              <div key={ticket.id} className="p-4 bg-white border border-gray-100 rounded-xl">
                {/* Top: Date | Amount */}
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-800">
                    {formatDateDisplay(ticket.sale_date)}
                  </span>
                  <span className="font-semibold text-green-600 tabular-nums whitespace-nowrap">
                    {formatVnd(ticket.total_amount)}
                  </span>
                </div>

                {/* Middle: Ticket ID */}
                <div className="mt-1">
                  <span className="text-xs text-gray-400">
                    Mã phiếu: {ticket.ticket_number || '—'}
                  </span>
                </div>

                {/* Bottom: Notes */}
                <div className="mt-3 pt-2 border-t border-gray-50">
                  <span className="text-sm text-gray-600 leading-relaxed break-words block">
                    {ticket.notes || '—'}
                  </span>
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-between py-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="bg-white border border-gray-200 rounded-lg py-1.5 px-3 text-xs font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 hover:border-gray-300 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Trước
              </button>
              <span className="text-xs text-gray-500 font-medium tabular-nums">
                Trang {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="bg-white border border-gray-200 rounded-lg py-1.5 px-3 text-xs font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 hover:border-gray-300 transition-colors"
              >
                Sau
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
