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
        className={`fixed inset-0 bg-black/50 z-40 s1a-screen-only transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet — trượt lên từ đáy */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chọn kỳ kê khai"
        className={`fixed bottom-0 left-0 right-0 z-50 s1a-screen-only transition-transform duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'
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
                  className={`py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 select-none ${isActive
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
      <div className="bg-white border-b border-gray-200 s1a-screen-only">
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
      <div className="px-4 py-4 s1a-print-outer">
        <div id="s1a-print-document" className="s1a-print-document w-full max-w-[500px] mx-auto bg-white p-4 rounded-xl shadow-md border border-gray-200/60">
          {/* ── Header: Hộ kinh doanh (Cân đối 2 cột) ─────── */}
          <div className="s1a-doc-header flex justify-between items-start mb-3 pb-3 s1a-hdr-divider">
            {/* Cột trái — Thông tin HKD (~70%) */}
            <div className="s1a-hdr-left w-[70%] min-w-0 space-y-1">
              {/* Hộ Kinh Doanh */}
              <p className="s1a-hkd-name text-xs">
                <span className="font-bold uppercase tracking-wide text-gray-500">Hộ, Cá nhân KD: </span>
                <span className="text-sm font-bold text-gray-900">{business.business_name}</span>
              </p>
              {/* Địa chỉ */}
              <p className="s1a-hkd-meta text-xs text-gray-600">
                <span className="font-medium text-gray-500">Địa chỉ: </span>
                <span className="text-gray-700">{business.address}</span>
              </p>
              {/* Mã số thuế — clean inline, no badge chip */}
              <p className="s1a-hkd-meta text-xs text-gray-600">
                <span className="font-medium text-gray-500">Mã số thuế: </span>
                <span className="s1a-tax-code text-gray-700">{business.tax_code}</span>
              </p>
            </div>

            {/* Cột phải — Mẫu số (~30%) */}
            <div className="s1a-hdr-right w-[30%] text-right shrink-0 pl-4">
              <p className="text-sm font-bold text-gray-800">Mẫu số S1a-HKD</p>
              <p className="text-xs text-gray-400 mt-0.5">Thông tư 152/2021/TT-BTC</p>
            </div>
          </div>

          {/* ── Tiêu đề chính ──────────────────────── */}
          <div className="s1a-doc-title text-center mb-3">
            <h3 className="s1a-title text-sm font-bold text-gray-900 tracking-tight">
              SỔ DOANH THU BÁN HÀNG HOÁ, DỊCH VỤ
            </h3>
            <p className="s1a-period text-sm text-gray-600 mt-1">
              Kỳ kê khai: <strong>{kkText}</strong>
            </p>
          </div>



          {/* ── 2a. Bảng PREVIEW (screen only — bị ẩn khi in) ── */}
          <div className="s1a-preview-table s1a-screen-only overflow-x-auto border border-gray-800 rounded mt-3">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-800 px-2 py-2 font-semibold text-center w-[25%] whitespace-nowrap">Ngày tháng</th>
                  <th className="border border-gray-800 px-2 py-2 font-semibold text-left w-[50%]">Diễn giải</th>
                  <th className="border border-gray-800 px-2 py-2 font-semibold text-right w-[25%]">Số tiền</th>
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
          <div className="s1a-print-table hidden overflow-x-auto border border-gray-800 rounded mt-3">
            <table className="w-full border-collapse text-xs s1a-print-table-el">
              <thead>
                <tr className="bg-gray-100">
                  <th className="s1a-th-date border border-gray-800 px-2 py-2 font-semibold text-center whitespace-nowrap">Ngày tháng</th>
                  <th className="s1a-th-dien-giai border border-gray-800 px-2 py-2 font-semibold text-left">Diễn giải</th>
                  <th className="s1a-th-amount border border-gray-800 px-2 py-2 font-semibold text-right whitespace-nowrap">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((row, index) => (
                  <tr key={index}>
                    <td className="border border-gray-800 px-2 py-2 text-center whitespace-nowrap text-gray-800 align-middle">{row.date}</td>
                    <td className="border border-gray-800 px-2 py-2 text-gray-700 align-middle">{row.dienGiai}</td>
                    <td className="s1a-td-amount border border-gray-800 px-2 py-2 text-right whitespace-nowrap align-middle">
                      <span className="text-slate-800 font-semibold">{formatVnd(row.amount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-gray-800">
                  <td colSpan={2} className="border border-gray-800 px-2 py-2.5 font-bold text-sm">TỔNG</td>
                  <td className="s1a-td-amount border border-gray-800 px-2 py-2.5 text-right whitespace-nowrap">
                    <span className="text-slate-900 font-bold text-sm">{formatVnd(grandTotal)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── 2c. Preview note (screen only) ── */}
          {isLimited && (
            <div className="s1a-screen-only mt-3 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
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

          {/* ── Footer ký tên — structured 2-column ─────────── */}
          <div className="s1a-signature-block flex mt-6">
            {/* Left spacer (~52%) */}
            <div className="w-[52%]"></div>
            {/* Right signature column (~48%) */}
            <div className="s1a-signature w-[48%] text-center">
              <p className="text-sm text-gray-600 mb-5">Ngày 30 tháng {String(month).padStart(2, '0')} năm {year}</p>
              <p className="text-sm font-semibold text-gray-800 mb-0.5">NGƯỜI ĐẠI DIỆN HỘ KINH DOANH</p>
              <p className="text-xs text-gray-400 italic">(Ký, họ tên và đóng dấu nếu có)</p>
            </div>
          </div>

          {/* ── Watermark Preview ─────────────────────── */}
          <div className="s1a-screen-only mt-5 pt-4 border-t border-dashed border-gray-200 flex justify-center">
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
          /* ── 1. Rescue: document and all children visible ── */
          #s1a-print-document {
            visibility: visible !important;
          }
          #s1a-print-document * {
            visibility: visible !important;
          }

          /* ── 2. Outer padding wrapper — reset to full width, no padding ── */
          .s1a-print-outer {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          /* ── 3. Document block — full A4 width ── */
          #s1a-print-document {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background-color: #ffffff !important;
          }

          /* ── 4. All children visible ── */
          #s1a-print-document * {
            visibility: visible !important;
          }

          /* ── 5. Hide only actual screen-only UI controls ── */
          .s1a-screen-only {
            display: none !important;
          }

          /* ── 6. Show/hide the correct table ── */
          .s1a-preview-table {
            display: none !important;
          }
          .s1a-print-table {
            display: table !important;
          }

          /* ══════════════════════════════════════════
             LAYOUT POLISH — PRINT ONLY
          ══════════════════════════════════════════ */

          /* ── 7. HEADER: two-column proportions 70/30 ── */
          #s1a-print-document .s1a-doc-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
          }
          #s1a-print-document .s1a-hdr-left {
            width: 70% !important;
          }
          #s1a-print-document .s1a-hdr-right {
            width: 30% !important;
            text-align: right !important;
          }

          /* Header divider: clean 1pt black rule ── */
          #s1a-print-document .s1a-hdr-divider {
            border-top: 1pt solid #000 !important;
            padding-top: 6px !important;
            margin-top: 6px !important;
          }

          /* Vertical rhythm: header info → divider ── */
          #s1a-print-document .s1a-hdr-left {
            margin-top: 6px !important;
          }

          /* ── 8. TAX CODE: no badge, plain inline text ── */
          #s1a-print-document .s1a-tax-code {
            font-family: inherit !important;
            font-size: inherit !important;
            background: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            color: #1f2937 !important;
            font-weight: 600 !important;
          }

          /* ── 9. TITLE: tight vertical rhythm ── */
          #s1a-print-document .s1a-doc-title {
            margin-top: 10px !important;
          }

          /* Title → period gap ── */
          #s1a-print-document .s1a-period {
            margin-top: 4px !important;
          }

          /* ── 10. TABLE: full-width, fixed layout, correct proportions ── */
          #s1a-print-document .s1a-print-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            margin-top: 8px !important;
          }

          #s1a-print-document table.s1a-print-table-el {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 10pt !important;
          }

          /* Column proportions: 22 / 55 / 23 ── */
          #s1a-print-document table.s1a-print-table-el th.s1a-th-date {
            width: 22% !important;
          }
          #s1a-print-document table.s1a-print-table-el th.s1a-th-dien-giai {
            width: 55% !important;
          }
          #s1a-print-document table.s1a-print-table-el th.s1a-th-amount {
            width: 23% !important;
            text-align: right !important;
          }

          /* Body / data rows: 22 / 55 / 23 ── */
          #s1a-print-document table.s1a-print-table-el tbody td:first-child {
            width: 22% !important;
          }
          #s1a-print-document table.s1a-print-table-el tbody td:nth-child(2) {
            width: 55% !important;
          }
          #s1a-print-document table.s1a-print-table-el tbody td:last-child {
            width: 23% !important;
          }

          /* Tfoot total label / amount: 22 / 55 / 23 ── */
          #s1a-print-document table.s1a-print-table-el tfoot td:first-child {
            width: 77% !important;
          }
          #s1a-print-document table.s1a-print-table-el tfoot td.s1a-td-amount {
            width: 23% !important;
          }

          /* Table cell padding: 5px 7px ── */
          #s1a-print-document table.s1a-print-table-el th,
          #s1a-print-document table.s1a-print-table-el td {
            font-size: 10pt !important;
            padding: 5px 7px !important;
            line-height: 1.4 !important;
            vertical-align: middle !important;
          }

          /* Amount column: right-aligned, tabular, no wrap ── */
          #s1a-print-document table.s1a-print-table-el td.s1a-td-amount,
          #s1a-print-document table.s1a-print-table-el th.s1a-th-amount {
            text-align: right !important;
            white-space: nowrap !important;
          }

          /* Total row: bold 11pt ── */
          #s1a-print-document table.s1a-print-table-el tfoot td {
            font-size: 11pt !important;
            font-weight: 700 !important;
          }
          #s1a-print-document table.s1a-print-table-el tfoot td.s1a-td-amount {
            text-align: right !important;
          }

          /* ── 11. TABLE BORDERS: black 0.5pt, header 1pt, total 1.5pt ── */
          #s1a-print-document table.s1a-print-table-el th,
          #s1a-print-document table.s1a-print-table-el td {
            border: 0.5pt solid #000 !important;
          }
          #s1a-print-document table.s1a-print-table-el thead th {
            border-bottom-width: 1pt !important;
            border-color: #000 !important;
          }
          #s1a-print-document table.s1a-print-table-el tfoot td {
            border-top: 1.5pt solid #000 !important;
            border-bottom: none !important;
            border-left: none !important;
            border-right: none !important;
          }

          /* Header row shade ── */
          #s1a-print-document table.s1a-print-table-el thead th {
            background-color: #f5f5f5 !important;
          }

          /* Total row shade ── */
          #s1a-print-document table.s1a-print-table-el tfoot tr td {
            background-color: #fffbeb !important;
          }

          /* ── 12. SIGNATURE BLOCK: 52/48 two-column ── */
          #s1a-print-document .s1a-signature-block {
            display: flex !important;
            flex-direction: row !important;
            margin-top: 20px !important;
          }

          /* ── 13. TYPOGRAPHY sizes ── */
          /* HKD info 10–11pt ── */
          #s1a-print-document .s1a-hkd-name {
            font-size: 11pt !important;
            line-height: 1.4 !important;
          }
          #s1a-print-document .s1a-hkd-meta {
            font-size: 10pt !important;
            line-height: 1.5 !important;
          }

          /* Title 14pt bold ── */
          #s1a-print-document .s1a-title {
            font-size: 14pt !important;
            font-weight: 700 !important;
            line-height: 1.3 !important;
          }

          /* Period 10.5pt ── */
          #s1a-print-document .s1a-period {
            font-size: 10.5pt !important;
            line-height: 1.5 !important;
          }

          /* Signature 10pt ── */
          #s1a-print-document .s1a-signature {
            font-size: 10pt !important;
            line-height: 1.6 !important;
          }
          #s1a-print-document .s1a-signature p {
            font-size: 10pt !important;
          }

          /* ── 14. MULTI-PAGE SAFETY ── */
          #s1a-print-document table.s1a-print-table-el thead {
            display: table-header-group !important;
          }
          #s1a-print-document table.s1a-print-table-el tfoot {
            display: table-footer-group !important;
          }
          #s1a-print-document table.s1a-print-table-el tbody tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* ── 15. TEXT COLOURS — near-black accounting standard ── */
          .text-slate-900 { color: #0f172a !important; }
          .text-slate-800 { color: #1e293b !important; }
          .text-slate-700 { color: #334155 !important; }
          .text-slate-600 { color: #475569 !important; }
          .text-slate-500 { color: #64748b !important; }
          .text-gray-900  { color: #111827 !important; }
          .text-gray-800  { color: #1f2937 !important; }
          .text-gray-700  { color: #374151 !important; }
          .text-gray-600  { color: #4b5563 !important; }
          .text-gray-500  { color: #6b7280 !important; }
          .text-gray-400  { color: #9ca3af !important; }
          .text-emerald-600 { color: #059669 !important; }
          .text-emerald-500 { color: #10b981 !important; }

          /* ── 16. BACKGROUND COLOURS ── */
          .bg-white      { background-color: #ffffff !important; }
          .bg-gray-100   { background-color: #f5f5f5 !important; }
          .bg-slate-100  { background-color: #ffffff !important; }
          .bg-amber-50   { background-color: #fffbeb !important; }
          .bg-slate-50   { background-color: #ffffff !important; }

          /* ── 17. OVERFLOW — prevent blank extra pages ── */
          .overflow-x-auto {
            overflow: visible !important;
          }

          /* ── 18. A4 PAGE DEFINITION ── */
          @page {
            size: A4 portrait;
            margin: 12mm 14mm;
          }
        }
      `}</style>
    </div>
  )
}
