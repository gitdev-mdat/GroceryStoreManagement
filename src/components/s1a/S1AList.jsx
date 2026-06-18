import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { formatVnd } from '../FormatNumber'
import { formatDateDisplay } from '../FormatDate'

// Skeleton Components
function TableSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i}>
          <td className="px-3 py-3"><div className="h-4 w-20 rounded bg-slate-200 animate-pulse" /></td>
          <td className="px-3 py-3"><div className="h-4 w-32 rounded bg-slate-200 animate-pulse" /></td>
          <td className="px-3 py-3"><div className="h-4 w-48 rounded bg-slate-200 animate-pulse" /></td>
          <td className="px-3 py-3 number-cell"><div className="h-4 w-24 rounded bg-slate-200 animate-pulse ml-auto" /></td>
        </tr>
      ))}
    </>
  )
}

function CardSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <div className="h-5 w-28 rounded bg-slate-200 animate-pulse" />
            <div className="h-5 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="h-3 w-3/4 rounded bg-slate-200 animate-pulse mb-1.5" />
          <div className="h-3 w-1/2 rounded bg-slate-200 animate-pulse" />
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

      {/* Desktop: Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Ngày tháng</th>
              <th>Số phiếu</th>
              <th>Diễn giải</th>
              <th className="number-cell">Số tiền (VND)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton />
            ) : monthRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-ink-muted py-8">
                  {isSupabaseConfigured()
                    ? 'Không có dữ liệu trong kỳ này.'
                    : 'Chưa kết nối Supabase. Vui lòng cấu hình .env.local'}
                </td>
              </tr>
            ) : (
              monthRows.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="whitespace-nowrap">{formatDateDisplay(ticket.sale_date)}</td>
                  <td className="whitespace-nowrap">{ticket.ticket_number || '—'}</td>
                  <td className="text-ink-muted italic">{ticket.notes || '—'}</td>
                  <td className="number-cell">{formatVnd(ticket.total_amount)}</td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && monthRows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={2} className="text-right">
                  Tổng cộng {totalTickets} phiếu phát sinh
                </td>
                <td>Tổng</td>
                <td className="number-cell text-emerald-700">
                  {totalAmount.toLocaleString('vi-VN')} VND
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile: Card List View */}
      <div className="block md:hidden">
        {loading ? (
          <CardSkeleton />
        ) : monthRows.length === 0 ? (
          <div className="text-center text-slate-400 py-8 text-sm">
            {isSupabaseConfigured() ? 'Không có dữ liệu trong kỳ này.' : 'Chưa kết nối Supabase.'}
          </div>
        ) : (
          <>
            {monthRows.map((ticket) => (
              <div key={ticket.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-3 flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-900">{formatDateDisplay(ticket.sale_date)}</span>
                  <span className="font-bold text-emerald-600 text-base">
                    {formatVnd(ticket.total_amount)} VND
                  </span>
                </div>
                <span className="text-xs text-slate-500">{ticket.ticket_number || '—'}</span>
                <span className="text-xs text-slate-400 italic">{ticket.notes || '—'}</span>
              </div>
            ))}
            {monthRows.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mt-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-emerald-800 font-medium">Tổng cộng {totalTickets} phiếu</span>
                    <br />
                    <span className="text-xs text-emerald-600">Tháng {filterMonth}</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-700">
                    {totalAmount.toLocaleString('vi-VN')} VND
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
