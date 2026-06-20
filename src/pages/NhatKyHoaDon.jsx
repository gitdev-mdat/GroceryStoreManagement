import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatDateDisplay } from '../components/FormatDate'
import { formatVndExact } from '../components/FormatNumber'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const PAGE_SIZE = 10

// ── Inline SVG Icons (Lucide-style) ──────────────────────────────────────────
const IconTrash = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>
)

const IconImage = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

const IconRefresh = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
)

const IconSearch = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const IconX = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const IconChevronLeft = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const IconChevronRight = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const IconChevronDown = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

// ── Type Badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  if (type === 'RETAIL') {
    return (
      <span className="inline-flex items-center rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-xs font-semibold text-sky-700 whitespace-nowrap">
        Bán lẻ
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-700 whitespace-nowrap">
      VAT
    </span>
  )
}

// ── Skeletons ─────────────────────────────────────────────────────────────────
function SkeletonRow({ cols = 8 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 rounded-md bg-slate-100 animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

function MobileCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="h-3.5 w-24 rounded bg-slate-100 animate-pulse" />
        <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <div className="h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-14 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
      <div className="flex justify-between items-center px-4 py-2 border-t border-slate-100 bg-slate-50/40">
        <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
        <div className="flex gap-1">
          <div className="h-7 w-7 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-7 w-7 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function calculateSmartRetailPrice(price) {
  if (!price || price <= 0) return 0
  if (price >= 2000) return Math.ceil(price * 1.15 / 1000) * 1000
  return Math.ceil(price * 1.15 / 100) * 100
}

function generateMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    options.push({
      value: `${year}-${String(month).padStart(2, '0')}`,
      label: `Tháng ${String(month).padStart(2, '0')}/${year}`,
    })
  }
  return options
}

const MONTH_OPTIONS = generateMonthOptions()

// ── Main Component ────────────────────────────────────────────────────────────
export default function NhatKyHoaDon() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterType, setFilterType] = useState('ALL')
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null)
  const [invoiceProducts, setInvoiceProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [viewerImage, setViewerImage] = useState(null)

  const { showToast, ToastContainer } = useToast()

  const fetchInvoices = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    setLoading(true)
    try {
      let q = supabase
        .from('invoices')
        .select(`id, serial_number, invoice_number, issue_date, invoice_type, total_amount, notes, image_url, supplier_id, suppliers(company_name, tax_code)`)
        .order('issue_date', { ascending: false })

      if (filterMonth) {
        const [year, month] = filterMonth.split('-')
        const startDate = `${year}-${month}-01`
        const endDate = month === '12'
          ? `${parseInt(year) + 1}-01-01`
          : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`
        q = q.gte('issue_date', startDate).lt('issue_date', endDate)
      }
      if (filterType === 'VAT') q = q.eq('invoice_type', 'VAT')
      else if (filterType === 'RETAIL') q = q.eq('invoice_type', 'RETAIL')

      const { data, error } = await q
      if (error) throw error
      setInvoices(data || [])
      setPage(0)
      setExpandedInvoiceId(null)
      setInvoiceProducts([])
    } catch (err) {
      console.error('Lỗi fetch hóa đơn:', err)
      showToast('Không thể tải danh sách hóa đơn.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterMonth, filterType])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return invoices.filter((row) => {
      if (!q) return true
      const s = row.suppliers || {}
      return (
        (row.serial_number || '').toLowerCase().includes(q) ||
        (row.invoice_number || '').toLowerCase().includes(q) ||
        (row.invoice_type || '').toLowerCase().includes(q) ||
        (s.company_name || '').toLowerCase().includes(q) ||
        (s.tax_code || '').toLowerCase().includes(q) ||
        (row.notes || '').toLowerCase().includes(q)
      )
    })
  }, [invoices, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleToggleExpand = async (invoiceId) => {
    if (expandedInvoiceId === invoiceId) {
      setExpandedInvoiceId(null); setInvoiceProducts([]); return
    }
    setExpandedInvoiceId(invoiceId)
    setIsLoadingProducts(true)
    setInvoiceProducts([])
    try {
      const { data, error } = await supabase
        .from('price_history')
        .select('*, products(product_name, unit)')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setInvoiceProducts(data || [])
    } catch {
      showToast('Không thể tải chi tiết sản phẩm.', 'error')
    } finally {
      setIsLoadingProducts(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const invoice = invoices.find(i => i.id === deleteId)
      const display = invoice?.invoice_number || invoice?.serial_number || `HĐ ${deleteId.slice(0, 8)}`
      await supabase.from('price_history').delete().eq('invoice_id', deleteId)
      const { error } = await supabase.from('invoices').delete().eq('id', deleteId)
      if (error) throw error
      setInvoices(prev => prev.filter(i => i.id !== deleteId))
      showToast(`Đã xóa hóa đơn ${display}`, 'success')
    } catch {
      showToast('Không thể xóa hóa đơn. Vui lòng thử lại.', 'error')
    } finally {
      setDeleting(false); setDeleteId(null)
    }
  }

  const deleteDialogInvoice = deleteId ? invoices.find(i => i.id === deleteId) : null
  const deleteDialogDisplay = deleteDialogInvoice?.invoice_number || deleteDialogInvoice?.serial_number || ''

  const cleanStr = (v) => v && v !== 'null' && v !== '' ? v : null

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-brand-700 m-0 lg:text-2xl">Nhật ký hóa đơn</h1>
      </div>

      <div className="card">

        {/* ── COHESIVE TOOLBAR ── */}
        <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center">

          {/* Search — expands on desktop */}
          <div className="relative lg:flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <IconSearch />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0) }}
              placeholder="Tìm theo tên công ty, MST, số hóa đơn..."
              className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] hover:border-slate-300 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                <IconX />
              </button>
            )}
          </div>

          {/* Right-side controls */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Month dropdown */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 font-medium outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] hover:border-slate-300 transition cursor-pointer"
              >
                {MONTH_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <IconChevronDown />
              </span>
            </div>

            {/* Type filter pills */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'VAT', label: 'VAT' },
                { key: 'RETAIL', label: 'Bán lẻ' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterType(key)}
                  className={`px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                    filterType === key
                      ? 'bg-[#1e3a5f] text-white shadow-inner'
                      : 'bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={fetchInvoices}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <IconRefresh />
              Làm mới
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-slate-400 font-medium mb-3">
          {loading ? 'Đang tải...' : `${filtered.length} hóa đơn`}
        </div>

        {/* ══ DESKTOP TABLE ══ */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">Ngày xuất</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Loại</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Tên nhà cung cấp</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">MST</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Ký hiệu</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">Số hóa đơn</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">Số tiền</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide w-20">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
              ) : pageItems.length > 0 ? (
                pageItems.map((row, idx) => {
                  const s = row.suppliers || {}
                  const displayName = s.company_name || null
                  const displayMst = cleanStr(s.tax_code)
                  const displaySymbol = cleanStr(row.serial_number)
                  const displayInvoiceNumber = cleanStr(row.invoice_number)

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-blue-50/30 ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}
                    >
                      <td className="px-4 py-3.5 text-slate-500 tabular-nums text-xs text-center whitespace-nowrap">
                        {row.issue_date ? formatDateDisplay(row.issue_date) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <TypeBadge type={row.invoice_type} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-800 font-medium max-w-[220px]">
                        {displayName
                          ? <span className="line-clamp-1 text-sm">{displayName}</span>
                          : <span className="text-slate-400 italic text-xs font-normal">Mua lẻ / Không có thông tin</span>
                        }
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-500 text-xs tabular-nums whitespace-nowrap">
                        {displayMst || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-500 text-xs tabular-nums whitespace-nowrap">
                        {displaySymbol || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-600 text-xs tabular-nums whitespace-nowrap">
                        {displayInvoiceNumber || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">
                        {formatVndExact(Number(row.total_amount) || 0)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-0.5">
                          {row.image_url && (
                            <button
                              type="button"
                              onClick={() => setViewerImage(row.image_url)}
                              title="Xem ảnh hóa đơn"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-blue-50 transition-all"
                            >
                              <IconImage />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteId(row.id)}
                            title="Xóa hóa đơn"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-slate-400 text-sm">
                    {isSupabaseConfigured()
                      ? 'Không có hóa đơn nào trong tháng này.'
                      : 'Chưa kết nối Supabase. Vui lòng cấu hình .env.local'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ══ MOBILE CARDS ══ */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <MobileCardSkeleton key={i} />)
          ) : pageItems.length > 0 ? (
            pageItems.map((row) => {
              const s = row.suppliers || {}
              const isExpanded = expandedInvoiceId === row.id
              const displayName = s.company_name || null
              const displayMst = cleanStr(s.tax_code)
              const displayInvoiceNumber = cleanStr(row.invoice_number) || cleanStr(row.serial_number)

              return (
                <div key={row.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                  {/* Top: Date + Amount */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                    <span className="text-xs text-slate-500 tabular-nums font-medium">
                      {row.issue_date ? formatDateDisplay(row.issue_date) : '—'}
                    </span>
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">
                      {formatVndExact(Number(row.total_amount) || 0)}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="font-semibold text-slate-900 text-sm leading-snug">
                      {displayName || <span className="text-slate-400 italic font-normal text-xs">Mua lẻ / Không có thông tin</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {displayInvoiceNumber && (
                        <span className="text-xs text-slate-500">
                          Số HĐ: <span className="font-semibold text-slate-700 tabular-nums">{displayInvoiceNumber}</span>
                        </span>
                      )}
                      {displayMst && (
                        <span className="text-xs text-slate-400 tabular-nums">MST: {displayMst}</span>
                      )}
                      <TypeBadge type={row.invoice_type} />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/40">
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(row.id)}
                      className="text-xs font-semibold text-[#1e3a5f] hover:text-[#16304f] transition-colors"
                    >
                      {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                    </button>
                    <div className="flex items-center gap-0.5">
                      {row.image_url && (
                        <button
                          type="button"
                          onClick={() => setViewerImage(row.image_url)}
                          title="Xem ảnh"
                          className="p-2 rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-blue-50 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
                        >
                          <IconImage />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteId(row.id)}
                        title="Xóa"
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {isLoadingProducts ? (
                        <div className="p-4 space-y-2">
                          {[1, 2].map(i => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)}
                        </div>
                      ) : invoiceProducts.length > 0 ? (
                        <div className="bg-slate-50 px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chi tiết sản phẩm</h4>
                            <span className="text-xs text-slate-400">{invoiceProducts.length} mặt hàng</span>
                          </div>
                          {invoiceProducts.map((item, idx) => {
                            const retailPrice = calculateSmartRetailPrice(item.unit_price_after_vat)
                            const isGift = item.row_type === 'KM'
                            return (
                              <div key={item.id} className={`bg-white rounded-lg p-3 border ${isGift ? 'border-amber-200' : 'border-slate-100'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs text-slate-400">{idx + 1}.</span>
                                    <span className="text-sm font-medium text-slate-800">{item.products?.product_name || '—'}</span>
                                    {isGift && (
                                      <span className="rounded-md bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-700">Quà tặng</span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">
                                    SL: <strong>{(item.quantity || 0).toLocaleString('vi-VN')}</strong> {item.products?.unit || ''}
                                  </span>
                                </div>
                                {!isGift && (
                                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 text-xs">
                                    <span className="text-slate-500">Giá nhập: <strong className="text-slate-700 tabular-nums">{Number(item.unit_price_after_vat || 0).toLocaleString('vi-VN')}đ</strong></span>
                                    <span className="text-[#1e3a5f] font-semibold tabular-nums">Bán lẻ: {retailPrice.toLocaleString('vi-VN')}đ</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-sm text-slate-400">Không có sản phẩm trong hóa đơn này.</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">Không có hóa đơn nào trong tháng này.</div>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-400 tabular-nums">
              Trang {page + 1} / {totalPages} &middot; {filtered.length} hóa đơn
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <IconChevronLeft />
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <IconChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Xóa hóa đơn"
        variant="danger"
        loading={deleting}
      >
        <p className="mb-2">Bạn có chắc chắn muốn xóa hóa đơn{deleteDialogDisplay ? ` số ${deleteDialogDisplay}` : ''}?</p>
        <p className="text-sm text-amber-600">Hành động này sẽ xóa toàn bộ sản phẩm đi kèm. Không thể hoàn tác.</p>
      </ConfirmDialog>

      <ToastContainer />

      {/* Image Viewer */}
      {viewerImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setViewerImage(null)}>
          <div className="relative max-h-[90vh] w-full max-w-3xl rounded-2xl bg-black p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/60 font-medium">Xem ảnh hóa đơn</span>
              <button type="button" className="rounded-lg bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20 transition" onClick={() => setViewerImage(null)}>
                Đóng
              </button>
            </div>
            <img src={viewerImage} alt="Ảnh hóa đơn" className="max-h-[80vh] w-full rounded-xl object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
