import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatVndExact } from '../components/FormatNumber'
import { useToast } from '../components/Toast'

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcRetail(price) {
  if (!price || price <= 0) return 0
  return price >= 2000
    ? Math.ceil(price * 1.15 / 1000) * 1000
    : Math.ceil(price * 1.15 / 100) * 100
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TraCuuGia() {
  const [products, setProducts] = useState([])
  const [priceData, setPriceData] = useState({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const { showToast, ToastContainer } = useToast()

  const fetchPriceBookFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, product_name, unit, status')
        .eq('status', 'ACTIVE')
        .order('product_name', { ascending: true })
      if (productsError) throw productsError

      const { data: historyData, error: historyError } = await supabase
        .from('price_history')
        .select('product_id, import_date, unit_price_after_vat, suggested_retail_price, is_active_price')
        .order('import_date', { ascending: false })
      if (historyError) throw historyError

      const priceMap = {}
      const prevPriceMap = {}

      historyData.forEach((h) => {
        const pid = h.product_id
        if (!priceMap[pid]) priceMap[pid] = h
      })

      historyData.forEach((h) => {
        const pid = h.product_id
        if (prevPriceMap[pid]) return
        const currentIdx = historyData.findIndex(x => x.id === h.id)
        if (currentIdx > 0) {
          const prev = historyData.slice(currentIdx + 1).find(x => x.product_id === pid)
          if (prev) prevPriceMap[pid] = prev
        }
      })

      setProducts(productsData || [])

      const pd = {}
      productsData?.forEach(p => {
        const latest = priceMap[p.id]
        const prev = prevPriceMap[p.id]
        let trend = { status: 'stable', percent: 0 }

        if (latest && prev) {
          const diff = latest.unit_price_after_vat - prev.unit_price_after_vat
          const percent = prev.unit_price_after_vat > 0
            ? (Math.abs(diff) / prev.unit_price_after_vat) * 100
            : 0
          if (diff > 0) trend = { status: 'up', percent }
          else if (diff < 0) trend = { status: 'down', percent }
        }

        pd[p.id] = {
          latest_price: latest?.unit_price_after_vat || 0,
          latest_retail_price: latest?.suggested_retail_price || 0,
          latest_date: latest?.import_date || null,
          trend,
        }
      })

      setPriceData(pd)
    } catch (err) {
      console.error('Lỗi fetch price book:', err)
      showToast('Không thể tải danh mục giá. Vui lòng thử lại.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPriceBookFromSupabase() }, [fetchPriceBookFromSupabase])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(item =>
      (item.product_name || '').toLowerCase().includes(q) ||
      (item.unit || '').toLowerCase().includes(q)
    )
  }, [products, query])

  useEffect(() => { setPage(1) }, [query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageItems = filtered.slice(start, start + PAGE_SIZE)
  const startItem = filtered.length === 0 ? 0 : start + 1
  const endItem = Math.min(start + PAGE_SIZE, filtered.length)

  const handleEdit = (item) => {
    const pd = priceData[item.id] || {}
    setEditingProduct({
      id: item.id,
      product_name: item.product_name,
      unit: item.unit,
      latest_price: pd.latest_price || 0,
    })
    setIsEditModalOpen(true)
  }

  const handleSaveEditProduct = async () => {
    if (!editingProduct) return
    setSaving(true)
    try {
      const { error: productError } = await supabase
        .from('products')
        .update({ product_name: editingProduct.product_name, unit: editingProduct.unit })
        .eq('id', editingProduct.id)
      if (productError) throw productError

      const pd = priceData[editingProduct.id]
      if (editingProduct.latest_price > 0 && editingProduct.latest_price !== pd?.latest_price) {
        await supabase.from('price_history').update({ is_active_price: false }).eq('product_id', editingProduct.id).eq('is_active_price', true)
        const suggestedRetail = calcRetail(editingProduct.latest_price)
        await supabase.from('price_history').insert([{
          product_id: editingProduct.id,
          import_date: new Date().toISOString().split('T')[0],
          unit_price_after_vat: editingProduct.latest_price,
          quantity: 0,
          row_type: 'MUA',
          suggested_retail_price: suggestedRetail,
          is_active_price: true,
        }])
      }

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

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { error } = await supabase.from('products').update({ trang_thai: 'INACTIVE' }).eq('id', deleteTarget.id)
      if (error) throw error
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id))
      showToast('Đã ẩn sản phẩm khỏi danh mục.', 'success')
    } catch (err) {
      console.error('Lỗi xóa:', err)
      showToast('Không thể xóa sản phẩm.', 'error')
    } finally {
      setSaving(false)
      setDeleteTarget(null)
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

        {/* ── TOOLBAR ── */}
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">

          {/* Search — grows to fill available space */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <IconSearch />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên sản phẩm hoặc đơn vị tính..."
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
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap hidden sm:block">
              {loading ? 'Đang tải...' : `${filtered.length} sản phẩm`}
            </span>
            <button
              type="button"
              onClick={fetchPriceBookFromSupabase}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <IconRefresh />
              Làm mới
            </button>
          </div>
        </div>

        {/* Count on mobile */}
        <div className="text-xs text-slate-400 font-medium mb-3 sm:hidden">
          {loading ? 'Đang tải...' : `${filtered.length} sản phẩm`}
        </div>

        {/* ══ DESKTOP TABLE ══ */}
        <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Tên sản phẩm</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">ĐVT</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">Giá nhập</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">Giá bán lẻ gợi ý</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Xu hướng</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} />)
                ) : pageItems.length > 0 ? (
                  pageItems.map((item, idx) => {
                    const pd = priceData[item.id] || {}
                    const retail = pd.latest_retail_price || calcRetail(pd.latest_price)
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-blue-50/30 ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}
                      >
                        {/* Tên */}
                        <td className="px-4 py-3.5 font-semibold text-slate-900 max-w-[240px]">
                          <span className="line-clamp-1">{item.product_name || '—'}</span>
                        </td>

                        {/* ĐVT */}
                        <td className="px-4 py-3.5 text-center text-slate-500 text-xs">
                          <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 font-medium text-slate-600">
                            {item.unit || '—'}
                          </span>
                        </td>

                        {/* Giá nhập */}
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                          {formatVndExact(Number(pd.latest_price) || 0)}
                        </td>

                        {/* Giá bán */}
                        <td className="px-4 py-3.5 text-right font-bold text-[#1e3a5f] tabular-nums whitespace-nowrap">
                          {formatVndExact(retail)}
                        </td>

                        {/* Xu hướng */}
                        <td className="px-4 py-3.5 text-center">
                          <TrendIndicator trend={pd.trend} />
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
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              title="Ẩn sản phẩm"
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
                    <td colSpan={6} className="px-4 py-14 text-center text-slate-400 text-sm">
                      {isSupabaseConfigured()
                        ? 'Chưa có dữ liệu giá sản phẩm. Hãy nhập hóa đơn đầu tiên!'
                        : 'Chưa kết nối Supabase. Vui lòng cấu hình .env.local'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ MOBILE CARDS ══ */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : pageItems.length > 0 ? (
            pageItems.map((item) => {
              const pd = priceData[item.id] || {}
              const retail = pd.latest_retail_price || calcRetail(pd.latest_price)
              return (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                  {/* Card Header: Product Name + Trend */}
                  <div className="flex items-start justify-between gap-2 px-4 py-3 bg-slate-50/60 border-b border-slate-100">
                    <span className="font-bold text-slate-900 text-sm leading-snug flex-1">{item.product_name || '—'}</span>
                    <TrendBadge trend={pd.trend} />
                  </div>

                  {/* Card Body: Price Grid */}
                  <div className="px-4 py-3">
                    {/* ĐVT pill */}
                    <div className="mb-2.5">
                      <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {item.unit || '—'}
                      </span>
                    </div>

                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-slate-400 font-medium mb-0.5">Giá nhập / ĐVT</div>
                        <div className="font-semibold text-slate-800 text-sm tabular-nums">
                          {formatVndExact(Number(pd.latest_price) || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[#1e3a5f]/70 font-medium mb-0.5">Giá bán gợi ý</div>
                        <div className="font-bold text-[#1e3a5f] text-base tabular-nums">
                          {formatVndExact(retail)}
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
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:border-rose-200 transition-all min-h-[40px]"
                    >
                      <IconTrash size={13} />
                      Ẩn
                    </button>
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
                        className={`min-w-[34px] h-[34px] rounded-lg text-xs font-semibold transition-all ${
                          p === safePage
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
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Đơn giá nhập sau VAT (VND)</label>
                <input
                  type="number"
                  value={editingProduct.latest_price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, latest_price: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition"
                />
                {editingProduct.latest_price > 0 && (
                  <p className="mt-1.5 text-xs text-[#1e3a5f] font-medium">
                    → Giá bán lẻ gợi ý: {calcRetail(editingProduct.latest_price).toLocaleString('vi-VN')}đ
                  </p>
                )}
              </div>
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

      {/* ── Delete Confirm Dialog ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-base font-bold text-slate-900 mb-2">Ẩn sản phẩm khỏi danh mục?</h3>
              <p className="text-sm text-slate-500">
                Sản phẩm <span className="font-semibold text-slate-800">{deleteTarget.product_name}</span> sẽ bị ẩn khỏi danh sách tra cứu. Bạn có thể khôi phục lại sau.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDelete}
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
