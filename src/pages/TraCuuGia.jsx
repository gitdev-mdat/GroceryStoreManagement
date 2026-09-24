import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatVndExact } from '../components/FormatNumber'
import { useToast } from '../components/Toast'
import { queryPriceBook, filterPriceBook, formatStoredVnd } from '../lib/priceBook'
import { canonicalNameKey, normalizeCanonicalName, normalizeProductCode, normalizeUnitDisplay, normalizeUnitKey } from '../lib/productResolver'
import { createSupabaseProductVisibilityRepository, PRODUCT_STATUS, setProductVisibility } from '../lib/productVisibility'

const PAGE_SIZE = 10

// ── Inline SVG Icons (Lucide-style) ──────────────────────────────────────────
const IconPencil = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const IconTrash = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
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

const IconChevronLeft = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const IconChevronRight = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const IconClose = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ── Trend Indicator ───────────────────────────────────────────────────────────
function TrendIndicator({ trend }) {
  const status = trend?.status
  const percent = Number(trend?.percent || 0)

  if (status === 'up') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-600 whitespace-nowrap">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
        </svg>
        {percent.toFixed(1)}%
      </span>
    )
  }
  if (status === 'down') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-xs font-semibold text-sky-600 whitespace-nowrap">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="7" x2="17" y2="17" /><polyline points="17 7 17 17 7 17" />
        </svg>
        {percent.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500 whitespace-nowrap">
      <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
        <line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Ổn định
    </span>
  )
}

// ── Trend Badge (for mobile cards, slightly more prominent) ───────────────────
function TrendBadge({ trend }) {
  const status = trend?.status
  const percent = Number(trend?.percent || 0)

  if (status === 'up') return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-600">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
      </svg>
      Tăng {percent.toFixed(1)}%
    </span>
  )
  if (status === 'down') return (
    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 px-2.5 py-1 text-xs font-bold text-sky-600">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="7" x2="17" y2="17" /><polyline points="17 7 17 17 7 17" />
      </svg>
      Giảm {percent.toFixed(1)}%
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500">
      <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
        <line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Ổn định
    </span>
  )
}

// ── Skeletons ─────────────────────────────────────────────────────────────────
function SkeletonTableRow() {
  return (
    <tr>
      {[160, 48, 80, 80, 56, 40].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className={`h-4 rounded-md bg-slate-100 animate-pulse mx-auto`} style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/40">
        <div className="h-8 flex-1 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-8 w-16 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const loadLivePriceBook = status => queryPriceBook(supabase, { status })

export default function TraCuuGia({ loadPriceBook = loadLivePriceBook, forceMobile = false }) {
  const [products, setProducts] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [hideTarget, setHideTarget] = useState(null)
  const [visibilityFilter, setVisibilityFilter] = useState(PRODUCT_STATUS.ACTIVE)
  const [saving, setSaving] = useState(false)
  const loadRequestRef = useRef(0)

  const { showToast, ToastContainer } = useToast()

  const fetchPriceBookFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    const requestId = ++loadRequestRef.current
    setLoading(true)
    setLoadError(null)
    try {
      const nextProducts = await loadPriceBook(visibilityFilter)
      if (requestId === loadRequestRef.current) setProducts(nextProducts)
    } catch (err) {
      if (requestId !== loadRequestRef.current) return
      console.error('Lỗi fetch price book:', err)
      setLoadError(err)
      showToast('Không thể tải danh mục giá. Vui lòng thử lại.', 'error')
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false)
    }
  }, [loadPriceBook, visibilityFilter])

  useEffect(() => { fetchPriceBookFromSupabase() }, [fetchPriceBookFromSupabase])

  useEffect(() => {
    if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('catalogAudit')) return
    let cancelled = false
    import('../lib/catalogAudit.js').then(async ({ runLiveCatalogAudit }) => {
      const audit = await runLiveCatalogAudit(supabase)
      if (cancelled) return
      const report = {
        total: audit.total,
        counts: audit.counts,
        statusCounts: audit.records.reduce((result, row) => {
          const status = row.product.status || 'MISSING'
          result[status] = (result[status] || 0) + 1
          return result
        }, {}),
        safeRows: audit.records.filter(row => row.classification === 'SAFE_AUTOFIX').map(row => ({
          id: row.product.id,
          product_code: row.product.product_code,
          product_name: row.product.product_name,
          unit: row.product.unit,
          proposedChanges: row.proposedChanges,
        })),
        reviewRows: audit.records.filter(row => row.classification === 'REVIEW_REQUIRED').map(row => ({
          id: row.product.id,
          product_code: row.product.product_code,
          product_name: row.product.product_name,
          unit: row.product.unit,
          status: row.product.status,
          reasons: row.reasons,
          invoice_ids: [...new Set(row.historyUsage.map(history => history.invoice_id).filter(Boolean))],
        })),
        duplicateSkus: audit.duplicateSkus.map(group => ({
          sku: group.key,
          products: group.products.map(product => ({ id: product.id, product_name: product.product_name, unit: product.unit, status: product.status })),
        })),
      }
      console.info('__HAIKIEU_CATALOG_AUDIT__' + JSON.stringify(report))
    }).catch(error => console.error('__HAIKIEU_CATALOG_AUDIT_ERROR__', error))
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => filterPriceBook(products, query), [products, query])

  useEffect(() => { setPage(1) }, [query, visibilityFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageItems = filtered.slice(start, start + PAGE_SIZE)
  const startItem = filtered.length === 0 ? 0 : start + 1
  const endItem = Math.min(start + PAGE_SIZE, filtered.length)

  const handleEdit = (item) => {
    setEditingProduct({
      id: item.id,
      product_code: item.product_code,
      product_name: item.product_name,
      unit: item.unit,
    })
    setIsEditModalOpen(true)
  }

  const handleSaveEditProduct = async () => {
    if (!editingProduct) return
    const cleanName = normalizeCanonicalName(editingProduct.product_name)
    const cleanUnit = normalizeUnitDisplay(editingProduct.unit)
    const cleanCode = normalizeProductCode(editingProduct.product_code)
    if (!cleanName || !cleanUnit) {
      showToast('Tên sản phẩm và đơn vị tính không được để trống.', 'error')
      return
    }
    const { data: allProducts, error: identityError } = await supabase
      .from('products')
      .select('id, product_code, product_name, unit, status')
      .neq('id', editingProduct.id)
    if (identityError) {
      showToast('Không thể kiểm tra xung đột danh tính sản phẩm.', 'error')
      return
    }
    const collision = (allProducts || []).find(product => (
      (cleanCode &&
        normalizeProductCode(product.product_code) === cleanCode &&
        normalizeUnitKey(product.unit) === normalizeUnitKey(cleanUnit)) ||
      (canonicalNameKey(product.product_name) === canonicalNameKey(cleanName) &&
        normalizeUnitKey(product.unit) === normalizeUnitKey(cleanUnit))
    ))
    if (collision) {
      showToast(`Danh tính này đang trùng với sản phẩm ${collision.product_code || collision.product_name}.`, 'error')
      return
    }
    const sameSkuDifferentUnit = cleanCode && (allProducts || []).find(product =>
      normalizeProductCode(product.product_code) === cleanCode &&
      normalizeUnitKey(product.unit) !== normalizeUnitKey(cleanUnit)
    )
    if (sameSkuDifferentUnit && !window.confirm(`SKU ${cleanCode} cũng đang được dùng cho đơn vị ${sameSkuDifferentUnit.unit}. Bạn có chắc muốn tiếp tục?`)) return
    setSaving(true)
    try {
      const { error: productError } = await supabase
        .from('products')
        .update({ product_code: cleanCode || null, product_name: cleanName, unit: cleanUnit })
        .eq('id', editingProduct.id)
      if (productError) throw productError

      showToast('Cập nhật sản phẩm thành công!', 'success')
      setIsEditModalOpen(false)
      setEditingProduct(null)
      fetchPriceBookFromSupabase()
    } catch (err) {
      console.error('Lỗi cập nhật:', err)
      showToast('Không thể cập nhật sản phẩm.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const changeVisibility = async (product, status) => {
    if (!product) return
    setSaving(true)
    try {
      const repository = createSupabaseProductVisibilityRepository(supabase)
      await setProductVisibility(repository, product.id, status)
      setProducts(prev => prev.filter(item => item.id !== product.id))
      showToast(status === PRODUCT_STATUS.ACTIVE ? 'Đã khôi phục sản phẩm.' : 'Đã ẩn sản phẩm khỏi danh mục.', 'success')
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái:', err)
      showToast('Không thể cập nhật trạng thái sản phẩm.', 'error')
    } finally {
      setSaving(false)
      setHideTarget(null)
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-brand-700 m-0 lg:text-2xl">Tra cứu giá sản phẩm</h1>
      </div>

      <div className="card">

        <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Trạng thái sản phẩm">
          {[
            [PRODUCT_STATUS.ACTIVE, 'Đang sử dụng'],
            [PRODUCT_STATUS.INACTIVE, 'Đã ẩn'],
          ].map(([status, label]) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={visibilityFilter === status}
              onClick={() => setVisibilityFilter(status)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${visibilityFilter === status ? 'bg-white text-[#1e3a5f] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── TOOLBAR ── */}
        <div className={`flex flex-col gap-3 mb-4 ${forceMobile ? '' : 'sm:flex-row sm:items-center'}`}>

          {/* Search — grows to fill available space */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <IconSearch />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo mã SKU hoặc tên sản phẩm..."
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

          {/* Count + Refresh */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`text-xs text-slate-400 font-medium whitespace-nowrap ${forceMobile ? 'hidden' : 'hidden sm:block'}`}>
              {loading ? 'Đang tải...' : `${filtered.length} sản phẩm`}
            </span>
            <button
              type="button"
              onClick={fetchPriceBookFromSupabase}
              disabled={loading}
              className={`${forceMobile ? 'w-full' : 'w-full sm:w-auto'} inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap`}
            >
              <IconRefresh />
              Làm mới
            </button>
          </div>
        </div>

        {/* Count on mobile */}
        <div className={`text-xs text-slate-400 font-medium mb-3 ${forceMobile ? '' : 'sm:hidden'}`}>
          {loading ? 'Đang tải...' : `${filtered.length} sản phẩm`}
        </div>

        {/* ══ DESKTOP TABLE ══ */}
        <div className={`${forceMobile ? 'hidden' : 'hidden md:block'} rounded-xl border border-slate-200 overflow-hidden`}>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Tên sản phẩm</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Mã SKU</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">ĐVT</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">Giá nhập</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">Giá bán lẻ gợi ý</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Trạng thái</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} />)
                ) : pageItems.length > 0 ? (
                  pageItems.map((item, idx) => {
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-blue-50/30 ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}
                      >
                        {/* Tên */}
                        <td className="px-4 py-3.5 font-semibold text-slate-900 max-w-[240px]">
                          <span className="line-clamp-2 leading-snug">{item.product_name || '—'}</span>
                        </td>

                        <td className="px-4 py-3.5 text-left font-mono text-xs font-semibold text-slate-600 whitespace-nowrap">
                          {item.product_code || '—'}
                        </td>

                        {/* ĐVT */}
                        <td className="px-4 py-3.5 text-center text-slate-500 text-xs">
                          <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 font-medium text-slate-600">
                            {item.unit || '—'}
                          </span>
                        </td>

                        {/* Giá nhập */}
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                          {formatStoredVnd(item.purchase_price, formatVndExact)}
                        </td>

                        {/* Giá bán */}
                        <td className="px-4 py-3.5 text-right font-bold text-[#1e3a5f] tabular-nums whitespace-nowrap">
                          {formatStoredVnd(item.suggested_retail_price, formatVndExact)}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === PRODUCT_STATUS.ACTIVE ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {item.status === PRODUCT_STATUS.ACTIVE ? 'Đang dùng' : 'Đã ẩn'}
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              title="Chỉnh sửa"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-blue-50 transition-all"
                            >
                              <IconPencil />
                            </button>
                            {item.status === PRODUCT_STATUS.ACTIVE ? (
                              <button
                                type="button"
                                onClick={() => setHideTarget(item)}
                                title="Ẩn sản phẩm"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                              >
                                <IconTrash />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => changeVisibility(item, PRODUCT_STATUS.ACTIVE)}
                                title="Khôi phục sản phẩm"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                              >
                                <IconRefresh />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center text-slate-400 text-sm">
                      {loadError
                        ? 'Không thể tải dữ liệu. Vui lòng thử lại.'
                        : query.trim()
                          ? 'Không tìm thấy sản phẩm phù hợp.'
                          : isSupabaseConfigured()
                            ? 'Danh mục hiện chưa có sản phẩm.'
                            : 'Chưa kết nối Supabase. Vui lòng cấu hình .env.local'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ MOBILE CARDS ══ */}
        <div className={`${forceMobile ? 'block' : 'block md:hidden'} space-y-3`}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : pageItems.length > 0 ? (
            pageItems.map((item) => {
              return (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                  <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100">
                    <div className="font-bold text-slate-900 text-sm leading-snug break-words">{item.product_name || '—'}</div>
                    {(item.product_code || item.unit) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                        {item.product_code && <span className="font-mono">Mã: {item.product_code}</span>}
                        {item.unit && <span>ĐVT: {item.unit}</span>}
                      </div>
                    )}
                  </div>

                  {/* Card Body: Price Grid */}
                  <div className="px-4 py-3">
                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-slate-400 font-medium mb-0.5">Giá nhập</div>
                        <div className="font-semibold text-slate-800 text-sm tabular-nums">
                          {formatStoredVnd(item.purchase_price, formatVndExact)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[#1e3a5f]/70 font-medium mb-0.5">Giá bán gợi ý</div>
                        <div className="font-bold text-[#1e3a5f] text-base tabular-nums">
                          {formatStoredVnd(item.suggested_retail_price, formatVndExact)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Actions */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/40">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#1e3a5f] hover:border-[#1e3a5f]/30 transition-all min-h-[40px]"
                    >
                      <IconPencil size={13} />
                      Sửa
                    </button>
                    {item.status === PRODUCT_STATUS.ACTIVE ? (
                      <button
                        type="button"
                        onClick={() => setHideTarget(item)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:border-rose-200 transition-all min-h-[40px]"
                      >
                        <IconTrash size={13} />
                        Ẩn
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => changeVisibility(item, PRODUCT_STATUS.ACTIVE)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-all min-h-[40px]"
                      >
                        <IconRefresh size={13} />
                        Khôi phục
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              Chưa có dữ liệu giá sản phẩm.
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-400 tabular-nums">
              {startItem}–{endItem} / {filtered.length} sản phẩm
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ⏮
              </button>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <IconChevronLeft />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1]
                  const showDots = prev && p - prev > 1
                  return (
                    <span key={p} className="contents">
                      {showDots && <span className="px-1.5 text-slate-300 text-xs">…</span>}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        className={`min-w-[34px] h-[34px] rounded-lg text-xs font-semibold transition-all ${p === safePage
                            ? 'bg-[#1e3a5f] text-white shadow-sm'
                            : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                      >
                        {p}
                      </button>
                    </span>
                  )
                })}

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <IconChevronRight />
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ⏭
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsEditModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Chỉnh sửa sản phẩm</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <IconClose />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Mã SKU</label>
                <input
                  type="text"
                  value={editingProduct.product_code || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, product_code: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tên sản phẩm</label>
                <input
                  type="text"
                  value={editingProduct.product_name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, product_name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Đơn vị tính</label>
                <input
                  type="text"
                  value={editingProduct.unit}
                  onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition"
                />
              </div>
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
                Giá chỉ được cập nhật từ hóa đơn để giữ đúng nguồn gốc và lịch sử giá.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditProduct}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hide Confirm Dialog ── */}
      {hideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-base font-bold text-slate-900 mb-2">Ẩn sản phẩm khỏi danh mục?</h3>
              <p className="text-sm leading-relaxed text-slate-500">
                <span className="font-semibold text-slate-800">{hideTarget.product_name}</span><br />
                Sản phẩm sẽ được ẩn khỏi danh sách tra cứu. Dữ liệu hóa đơn và lịch sử giá vẫn được giữ nguyên.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setHideTarget(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => changeVisibility(hideTarget, PRODUCT_STATUS.INACTIVE)}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Đang ẩn...' : 'Xác nhận ẩn'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  )
}
