import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { formatVnd } from '../components/FormatNumber'
import { formatDateDisplay } from '../components/FormatDate'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Sổ Doanh thu bán hàng hóa, dịch vụ — Mẫu S1a-HKD
 * Theo Thông tư 152/2021/TT-BTC.
 *
 * Đặc điểm:
 * - Gom toàn bộ phiếu trong tháng (không chia nhóm ngành nghề)
 * - Sắp xếp theo trình tự thời gian (ngày tăng dần)
 * - Bảng 3 cột: Ngày tháng (A) | Diễn giải (B) | Số tiền (1)
 * - Tiêu đề bảng 2 dòng: dòng 1 = tên cột, dòng 2 = ký hiệu (A, B, 1)
 * - Ký hiệu căn lề phải, in nghiêng
 */
export default function SoS1aHKD({ onBack }) {
  const { s2aSettings } = useApp()
  const printRef = useRef(null)

  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [loading, setLoading] = useState(false)
  const [rawTickets, setRawTickets] = useState([])

  const fetchS1ABookData = async () => {
    if (!isSupabaseConfigured()) {
      setRawTickets([])
      return
    }

    setLoading(true)
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const { data, error } = await supabase
        .from('sales_tickets')
        .select('sale_date, total_amount, notes')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: true })

      if (error) throw error
      setRawTickets(data || [])
    } catch (err) {
      console.error('Loi fetch du lieu s1a book:', err)
      setRawTickets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchS1ABookData()
  }, [month, year])

  // Group by date and sum amounts, dien giai luon theo mau chuan
  const monthRows = useMemo(() => {
    const groups = {}
    rawTickets.forEach((ticket) => {
      const date = ticket.sale_date
      if (!date) return
      if (!groups[date]) {
        groups[date] = { date, totalAmount: 0 }
      }
      groups[date].totalAmount += Number(ticket.total_amount) || 0
    })

    return Object.values(groups)
      .map((g) => {
        const [y, m, d] = g.date.split('-')
        const displayDate = `${d}/${m}/${y}`
        const dienGiai = `Doanh thu bán lẻ hàng hóa, dịch vụ phát sinh ngày ${displayDate}`

        return {
          date: g.date,
          displayDate,
          dienGiai,
          totalAmount: g.totalAmount,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [rawTickets])

  const grandTotal = monthRows.reduce((s, r) => s + r.totalAmount, 0)

  const lastDay = useMemo(() => new Date(year, month, 0).getDate(), [month, year])

  const kk = `Tháng ${String(month).padStart(2, '0')} năm ${year}`

  const handlePrint = () => {
    window.print()
  }

  return (
    <div>
      {/* ── Controls ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="form-group !mb-0" style={{ minWidth: '120px' }}>
          <label>Tháng</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="input-base"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
        </div>
        <div className="form-group !mb-0" style={{ minWidth: '110px' }}>
          <label>Năm</label>
          <input
            type="number"
            min={2020}
            max={2030}
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || today.getFullYear())}
            className="input-base"
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={handlePrint}>
          In / Xuất PDF
        </button>
      </div>

      {/* ── Print Area ───────────────────────────────────────── */}
      <div ref={printRef} className="s1a-ledger-print">

        {/* Header: top-left info + top-right form label */}
        <div className="s1a-header">
          {/* Top-left: HKD info */}
          <div className="s1a-header-left">
            <p className="s1a-info-line">
              <strong>HỘ, CÁ NHÂN KINH DOANH:</strong>
              <span>{s2aSettings.businessName || '...................................................'}</span>
            </p>
            <p className="s1a-info-line">
              <strong>Địa chỉ:</strong>
              <span>{s2aSettings.address || '...................................................'}</span>
            </p>
            <p className="s1a-info-line">
              <strong>Mã số thuế:</strong>
              <span>{s2aSettings.mst || '...................................................'}</span>
            </p>
          </div>

          {/* Top-right: form label */}
          <div className="s1a-header-right">
            <p className="s1a-form-label">Mẫu số S1a-HKD</p>
            <p className="s1a-form-label-sub">
              (Ban hành kèm theo Thông tư số 152/2021/TT-BTC ngày 31 tháng 12 năm 2021 của Bộ trưởng Bộ Tài chính)
            </p>
          </div>
        </div>

        {/* Main title */}
        <div className="s1a-title-block">
          <p className="s1a-main-title">SỔ DOANH THU BÁN HÀNG HOÁ, DỊCH VỤ</p>
          <p className="s1a-meta-line">
            <span>Địa điểm kinh doanh: <strong>{s2aSettings.address || '...................................'}</strong></span>
          </p>
          <p className="s1a-meta-line">
            <span>Kỳ kê khai: <strong>{kk}</strong></span>
          </p>
        </div>

        {/* Data table */}
        <div className="s1a-table-wrapper">
          <table className="s1a-table">
            <thead>
              {/* Row 1: Column titles */}
              <tr>
                <th className="s1a-th s1a-th-date">Ngày tháng</th>
                <th className="s1a-th s1a-th-desc">Diễn giải</th>
                <th className="s1a-th s1a-th-amount">Số tiền</th>
              </tr>
              {/* Row 2: Column symbols */}
              <tr>
                <th className="s1a-th-symbol">A</th>
                <th className="s1a-th-symbol">B</th>
                <th className="s1a-th-symbol s1a-th-symbol-right">1</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="s1a-empty">Đang tải dữ liệu...</td>
                </tr>
              ) : monthRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="s1a-empty">
                    Không có dữ liệu doanh thu phát sinh trong kỳ kê khai này.
                  </td>
                </tr>
              ) : (
                monthRows.map((row) => (
                  <tr key={row.date} className="s1a-data-row">
                    <td className="s1a-td-date">{row.displayDate}</td>
                    <td className="s1a-td-desc">{row.dienGiai}</td>
                    <td className="s1a-td-amount">{row.totalAmount.toLocaleString('vi-VN')}</td>
                  </tr>
                ))
              )}
            </tbody>
            {monthRows.length > 0 && (
              <tfoot>
                <tr className="s1a-total-row">
                  <td colSpan={2} className="s1a-total-label">
                    <strong>CỘNG</strong>
                  </td>
                  <td className="s1a-total-amount">
                    <strong>{grandTotal.toLocaleString('vi-VN')}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer: signature block (right-aligned) */}
        <div className="s1a-footer">
          <p className="s1a-footer-date">
            Ngày {lastDay} tháng {String(month).padStart(2, '0')} năm {year}
          </p>
          <p className="s1a-footer-title">
            <strong>NGƯỜI ĐẠI DIỆN HỘ KINH DOANH / CÁ NHÂN KINH DOANH</strong>
          </p>
          <p className="s1a-footer-note">
            <em>(Ký, họ tên và đóng dấu (nếu có))</em>
          </p>
        </div>
      </div>
    </div>
  )
}
