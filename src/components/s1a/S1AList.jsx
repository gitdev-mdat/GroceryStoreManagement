import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { formatVnd } from '../FormatNumber'
import { formatDateDisplay } from '../FormatDate'

// Skeleton Component
function MobileCardSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="py-4 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div className="h-5 w-24 rounded bg-slate-200 animate-pulse" />
            <div className="h-5 w-20 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="h-3 w-32 rounded bg-slate-200 animate-pulse mt-2" />
          <div className="h-3 w-48 rounded bg-slate-200 animate-pulse mt-1" />
        </div>
      ))}
    </>
  )
}

export default function S1AList({ onNotify, onRefresh }) {
  const [loading, setLoading] = useState(false)
  const [allTickets, setAllTickets] = useState([])
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [availableMonths, setAvailableMonths] = useState([])

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

  return (
    <div className="card">
      {/* Summary Badges */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div />
        <div className="flex gap-3 text-sm">
          <span className="s1a-stat-badge">
            <span className="s1a-stat-num">{totalTickets}</span> phieu phat sinh
          </span>
          <span className="s1a-stat-badge">
            <span className="s1a-stat-num">{formatVnd(totalAmount)}</span> VND
          </span>
        </div>
      </div>

      {/* Filter: Month/Year Dropdown */}
      <div className="my-3">
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          {availableMonths.map((month) => {
            const [y, m] = month.split('-')
            const label = `Tháng ${m}/${y}`
            return (
              <option key={month} value={month}>
                {label}
              </option>
            )
          })}
        </select>
      </div>

      {/* ========================== */}
      {/* CARD LIST VIEW - Always visible */}
      {/* ========================== */}

      {/* Loading State */}
      {loading && <MobileCardSkeleton />}

      {/* Empty State */}
      {!loading && monthRows.length === 0 && (
        <div className="text-center text-slate-400 py-8 text-sm">
          {isSupabaseConfigured() ? 'Không có dữ liệu trong kỳ này.' : 'Chưa kết nối Supabase.'}
        </div>
      )}

      {/* Card List */}
      {!loading && monthRows.length > 0 && (
        <>
          {monthRows.map((ticket) => (
            <div
              key={ticket.id}
              className="py-4 border-b border-gray-100 last:border-b-0"
            >
              {/* Row 1: Date | Amount */}
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900">
                  {formatDateDisplay(ticket.sale_date)}
                </span>
                <span className="font-bold text-green-600 tabular-nums whitespace-nowrap pl-4">
                  {formatVnd(ticket.total_amount)}
                </span>
              </div>
              {/* Row 2: Ticket ID */}
              <div className="mt-1">
                <span className="text-xs text-gray-400">
                  Mã phiếu: {ticket.ticket_number || '—'}
                </span>
              </div>
              {/* Row 3: Notes */}
              <div className="mt-0.5">
                <span className="text-xs text-gray-600 leading-relaxed break-words">
                  {ticket.notes || '—'}
                </span>
              </div>
            </div>
          ))}

          {/* Summary Card */}
          <div className="my-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm text-emerald-800 font-semibold">
                  Tổng cộng {totalTickets} phiếu
                </span>
                <span className="block text-xs text-emerald-600 mt-0.5">
                  Tháng {filterMonth}
                </span>
              </div>
              <span className="text-lg font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                {formatVnd(totalAmount)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
