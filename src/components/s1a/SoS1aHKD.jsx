import React, { useState, useEffect, useCallback } from 'react'

/**
 * Mẫu in sổ S1A-HKD — Print Preview Template
 * Component tĩnh: Hiển thị form mẫu, không fetch dữ liệu
 */

// ─────────────────────────────────────────
// Bottom Sheet: Chọn Kỳ Kê Khai
// ─────────────────────────────────────────
function PeriodSheet({ month, year, onSelect, onClose }) {
  const [tempMonth, setTempMonth] = useState(month)
  const [tempYear, setTempYear] = useState(year)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(onClose, 250)
  }, [onClose])

  const handleConfirm = () => {
    onSelect(tempMonth, tempYear)
  }

  const MONTHS = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
  ]

  return (
    <>
      {/* Overlay — mờ dần vào */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 print:hidden transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet — trượt lên từ đáy */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chọn kỳ kê khai"
        className={`fixed bottom-0 left-0 right-0 z-50 print:hidden transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white rounded-t-3xl shadow-2xl px-4 pb-8 pt-3 max-w-[500px] mx-auto">
          {/* Drag handle — "Thanh xám nhỏ vuốt xuống" */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 mt-1" />

          {/* Tiêu đề — uppercase tracking-widest */}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-1">
            Chọn kỳ kê khai
          </p>

          {/* Preview: Kỳ đang chọn */}
          <p className="text-center text-sm font-semibold text-gray-700 mb-5">
            {`Tháng ${String(tempMonth).padStart(2, '0')} / ${tempYear}`}
          </p>

          {/* ── Chọn Năm ─────────────────────── */}
          <div className="flex items-center justify-center gap-6 mb-5">
            <button
              type="button"
              aria-label="Năm trước"
              onClick={() => setTempYear((y) => y - 1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all select-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <span className="text-xl font-extrabold text-gray-800 w-24 text-center select-none tracking-wide">
              {tempYear}
            </span>

            <button
              type="button"
              aria-label="Năm sau"
              onClick={() => setTempYear((y) => y + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all select-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* ── Ma trận 12 tháng (4 cột) ─────── */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {MONTHS.map((label, idx) => {
              const m = idx + 1
              const isActive = tempMonth === m
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setTempMonth(m)}
                  className={`py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 select-none ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-200 ring-2 ring-brand-400'
                      : 'bg-gray-50 text-gray-700 hover:bg-brand-50 hover:text-brand-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* ── Nút Xác nhận ─────────────── */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-brand-700 active:scale-[0.98] transition-transform shadow-lg shadow-brand-200"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────
// Main Component: SoS1aHKD
// ─────────────────────────────────────────

import { supabase, isSupabaseConfigured } from '../../lib/supabase'

/** Số dòng preview giới hạn trên màn hình */
const PREVIEW_LIMIT = 2

/** Mặc định HKD (fallback khi chưa có business_profiles) */
const DEFAULT_BUSINESS = {
  business_name: 'Hộ Kinh Doanh Tạp hoá Hải Kiều',
  tax_code: '051179002157',
  address: 'Thôn 10, Xã Quảng Tín, Tỉnh Lâm Đồng, Việt Nam',
}

/** Format date ISO → DD/MM/YYYY */
const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function SoS1aHKD({ onBack }) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [openSheet, setOpenSheet] = useState(false)

  // ── 1. FETCH: sales_tickets (theo kỳ) ──
  const [tickets, setTickets] = useState([])
  const [ticketsLoading, setTicketsLoading] = useState(false)

  // ── 2. FETCH: business_profiles (1 row active) ──
  const [business, setBusiness] = useState(DEFAULT_BUSINESS)

  // Fetch tickets khi month/year thay đổi
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setTickets([])
      return
    }

    setTicketsLoading(true)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0] // last day of month

    supabase
      .from('sales_tickets')
      .select('sale_date, total_amount, notes, group_key')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          // Map sang shape: { date, dienGiai, amount }
          const mapped = data.map((row) => ({
            date: formatDate(row.sale_date),
            dienGiai: row.notes || `Doanh thu bán lẻ hàng hóa, dịch vụ phát sinh ngày ${formatDate(row.sale_date)}`,
            amount: Number(row.total_amount) || 0,
          }))
          setTickets(mapped)
        } else {
          setTickets([])
        }
      })
      .finally(() => setTicketsLoading(false))
  }, [month, year])

  // Fetch business profile (1 lần khi mount)
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    supabase
      .from('business_profiles')
      .select('business_name, tax_code, address')
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setBusiness({
            business_name: data.business_name || DEFAULT_BUSINESS.business_name,
            tax_code: data.tax_code || DEFAULT_BUSINESS.tax_code,
            address: data.address || DEFAULT_BUSINESS.address,
          })
        }
      })
  }, [])

  const grandTotal = tickets.reduce((sum, row) => sum + row.amount, 0)
  const formatVnd = (num) => new Intl.NumberFormat('vi-VN').format(num) + ' đ'
  const kkText = `Tháng ${String(month).padStart(2, '0')} năm ${year}`

  // ── 3. UX: Cắt preview nếu data lớn hơn limit ──
  const isLimited = tickets.length > PREVIEW_LIMIT
  const displayData = isLimited ? tickets.slice(0, PREVIEW_LIMIT) : tickets

  const handlePeriodConfirm = useCallback((m, y) => {
    setMonth(m)
    setYear(y)
    setOpenSheet(false)
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* ═══════════════════════════════════════════════════
          TOP BAR — Navigation + Branding + Actions
      ═══════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 print:hidden">
        <div className="px-4 py-3">
          {/* Row 1: Back + Title (Left) | Month Selector (Right) */}
          <div className="flex justify-between items-center gap-3 w-full mb-3">
            {/* Left: Back arrow + Title */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onBack}
                aria-label="Quay lại Hub"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base md:text-lg font-bold text-gray-900 truncate">Mẫu in sổ S1A-HKD</h2>
            </div>

            {/* Right: Month selector + Print */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Month selector */}
              <button
                type="button"
                onClick={() => setOpenSheet(true)}
                aria-label="Chọn kỳ kê khai"
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 h-9 text-xs md:text-sm flex items-center gap-1.5 font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-300 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="truncate max-w-[120px] md:max-w-none">{kkText}</span>
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Print button — icon-only on mobile, text on md+ */}
              <button
                type="button"
                onClick={() => window.print()}
                aria-label="In"
                className="bg-brand-600 active:scale-[0.97] transition-all text-white h-9 flex items-center justify-center hover:bg-brand-700 shadow-sm shadow-brand-200 rounded-lg md:px-4 md:gap-2 px-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span className="hidden md:inline text-sm font-semibold">In</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          TỜ GIẤY A4 — Card giấy in nổi bật
      ═══════════════════════════════════════════════════ */}
      <div className="px-4 py-4">
        <div className="w-full max-w-[500px] mx-auto bg-white p-4 rounded-xl shadow-md border border-gray-200/60">
          {/* ── Header: Hộ kinh doanh (Cân đối 2 cột) ─────── */}
          <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-300">
            {/* Cột trái — Thông tin HKD */}
            <div className="w-3/5 min-w-0 space-y-1">
              {/* Dòng 1: Hộ Kinh Doanh */}
              <p className="text-xs">
                <span className="font-bold uppercase tracking-wide text-gray-500">Hộ, Cá nhân KD: </span>
                <span className="text-sm font-bold text-gray-900">{business.business_name}</span>
              </p>
              {/* Dòng 2: Địa chỉ + MST cùng hàng */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                <span className="font-medium text-gray-500 whitespace-nowrap shrink-0">Địa chỉ: </span>
                <span className="text-gray-700">{business.address}</span>
                <span className="font-medium text-gray-500 shrink-0">MST:</span>
                <span className="font-mono font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                  {business.tax_code}
                </span>
              </div>
            </div>

            {/* Cột phải — Mẫu số */}
            <div className="w-2/5 text-right shrink-0 pl-4">
              <p className="text-sm font-bold text-gray-800">Mẫu số S1a-HKD</p>
              <p className="text-xs text-gray-400 mt-0.5">Thông tư 152/2021/TT-BTC</p>
            </div>
          </div>

          {/* ── Tiêu đề chính ──────────────────────── */}
          <div className="text-center mb-4">
            <h3 className="text-sm font-bold text-gray-900 tracking-tight">
              SỔ DOANH THU BÁN HÀNG HOÁ, DỊCH VỤ
            </h3>
            <p className="text-sm text-gray-600 mt-1.5">
              Kỳ kê khai: <strong>{kkText}</strong>
            </p>
          </div>

          

          {/* ── 2a. Bảng PREVIEW (screen only — bị ẩn khi in) ── */}
          <div className="overflow-x-auto border border-gray-800 rounded print:hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-800 px-2 py-2 font-semibold text-center w-[25%] whitespace-nowrap">Ngày tháng</th>
                  <th className="border border-gray-800 px-2 py-2 font-semibold text-left w-[50%]">Diễn giải</th>
                  <th className="border border-gray-800 px-2 py-2 font-semibold text-right w-[25%]">Số tiền</th>
                </tr>
                <tr className="bg-white">
                  <th className="border border-gray-800 px-2 py-1 font-normal italic text-gray-500 text-xs text-center">A</th>
                  <th className="border border-gray-800 px-2 py-1 font-normal italic text-gray-500 text-xs">B</th>
                  <th className="border border-gray-800 px-2 py-1 font-normal italic text-gray-500 text-xs text-right">1</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-800 px-2 py-2 text-center whitespace-nowrap text-gray-800 align-middle">{row.date}</td>
                    <td className="border border-gray-800 px-2 py-2 text-gray-700 align-middle">{row.dienGiai}</td>
                    <td className="border border-gray-800 px-2 py-2 text-right whitespace-nowrap align-middle">
                      <span className="text-slate-800 font-semibold">{formatVnd(row.amount)}</span>
                    </td>
                  </tr>
                ))}
                {/* Placeholder row when data exceeds preview limit */}
                {tickets.length > PREVIEW_LIMIT && (
                  <tr className="border-t border-b border-gray-200">
                    <td colSpan={3} className="px-2 py-2 text-center bg-gray-50/50">
                      <span className="text-gray-400 italic text-xs tracking-wide">
                        ... và {tickets.length - PREVIEW_LIMIT} dòng khác được ẩn trong bản xem trước ...
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-gray-800">
                  <td colSpan={2} className="border border-gray-800 px-2 py-2.5 font-bold text-sm">Tổng</td>
                  <td className="border border-gray-800 px-2 py-2.5 text-right whitespace-nowrap">
                    <span className="text-slate-900 font-bold text-sm">{formatVnd(grandTotal)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── 2b. Bảng PRINT FULL (ẩn trên screen, hiện khi in) ── */}
          <div className="hidden print:block overflow-x-auto border border-gray-800 rounded">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-800 px-2 py-2 font-semibold text-center w-[25%] whitespace-nowrap">Ngày tháng</th>
                  <th className="border border-gray-800 px-2 py-2 font-semibold text-left w-[50%]">Diễn giải</th>
                  <th className="border border-gray-800 px-2 py-2 font-semibold text-right w-[25%]">Số tiền</th>
                </tr>
                <tr className="bg-white">
                  <th className="border border-gray-800 px-2 py-1 font-normal italic text-gray-500 text-xs text-center">A</th>
                  <th className="border border-gray-800 px-2 py-1 font-normal italic text-gray-500 text-xs">B</th>
                  <th className="border border-gray-800 px-2 py-1 font-normal italic text-gray-500 text-xs text-right">1</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((row, index) => (
                  <tr key={index}>
                    <td className="border border-gray-800 px-2 py-2 text-center whitespace-nowrap text-gray-800 align-middle">{row.date}</td>
                    <td className="border border-gray-800 px-2 py-2 text-gray-700 align-middle">{row.dienGiai}</td>
                    <td className="border border-gray-800 px-2 py-2 text-right whitespace-nowrap align-middle">
                      <span className="text-slate-800 font-semibold">{formatVnd(row.amount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-gray-800">
                  <td colSpan={2} className="border border-gray-800 px-2 py-2.5 font-bold text-sm">TỔNG</td>
                  <td className="border border-gray-800 px-2 py-2.5 text-right whitespace-nowrap">
                    <span className="text-slate-900 font-bold text-sm">{formatVnd(grandTotal)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── 2c. Preview note (screen only) ── */}
          {isLimited && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 print:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-brand-600">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="8" />
                <line x1="12" y1="12" x2="12" y2="16" />
              </svg>
              <p className="text-xs leading-relaxed text-brand-700">
                Đang hiển thị bản xem trước <strong>{PREVIEW_LIMIT} dòng đầu</strong>. Toàn bộ dữ liệu sẽ được in đầy đủ khi bấm nút In.
              </p>
            </div>
          )}

          {/* ── Footer ký tên ───────────────────────── */}
          <div className="mt-5 text-right">
            <p className="text-sm text-gray-600 mb-1">Ngày 30 tháng {String(month).padStart(2, '0')} năm {year}</p>
            <p className="text-sm font-semibold text-gray-800 mb-0.5">NGƯỜI ĐẠI DIỆN HỘ KINH DOANH</p>
            <p className="text-xs text-gray-400 italic">(Ký, họ tên và đóng dấu (nếu có))</p>
          </div>

          {/* ── Watermark Preview ─────────────────────── */}
          <div className="mt-5 pt-4 border-t border-dashed border-gray-200 flex justify-center print:hidden">
            <span className="text-xs text-gray-400 italic">— Bản xem trước mẫu in —</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          BOTTOM SHEET — Chọn Kỳ Kê Khai
      ═══════════════════════════════════════════════════ */}
      {openSheet && (
        <PeriodSheet
          month={month}
          year={year}
          onSelect={handlePeriodConfirm}
          onClose={() => setOpenSheet(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════
          PRINT STYLES
      ═══════════════════════════════════════════════════ */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:shadow-none,
          .print\\:shadow-none * { visibility: visible; }
          .print\\:shadow-none {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            border: 1px solid #000 !important;
          }
          .print\\:hidden { display: none !important; }
          .min-h-screen { min-height: auto !important; }
          .bg-slate-100, .bg-gray-100 { background: white !important; }
          .bg-white { background: white !important; }
          .bg-gray-100 { background: #f5f5f5 !important; }
          .bg-amber-50 { background: #fffbeb !important; }
          .text-green-600 { color: #15803d !important; }
          .text-blue-700 { color: #1d4ed8 !important; }
          .border-gray-800 { border-color: #000 !important; }
          .overflow-x-auto { overflow: visible !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
    </div>
  )
}
