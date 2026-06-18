import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatVndExact } from '../components/FormatNumber'
import { useToast } from '../components/Toast'

const PAGE_SIZE = 10

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function TrendBadge({ trend }) {
  const status = trend?.status
  const percent = Number(trend?.percent || 0)

  if (status === 'up') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        🔺 Tăng {percent.toFixed(1)}%
      </span>
    )
  }
  if (status === 'down') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
        🔻 Giảm {percent.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      🟢 Ổn định
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
      <div className="h-5 w-3/4 rounded bg-slate-200 animate-pulse mb-2" />
      <div className="h-4 w-1/2 rounded bg-slate-200 animate-pulse mb-3" />
      <div className="h-12 w-full rounded bg-slate-200 animate-pulse mb-3" />
      <div className="h-10 w-full rounded bg-slate-200 animate-pulse" />
    </div>
  )
}

function SkeletonTableRow() {
  return (
    <tr>
      <td className="px-4 py-3.5"><div className="h-5 w-32 rounded bg-slate-200 animate-pulse" /></td>
      <td className="px-3 py-3.5"><div className="h-5 w-12 mx-auto rounded bg-slate-200 animate-pulse" /></td>
      <td className="px-3 py-3.5"><div className="h-5 w-20 mx-auto rounded bg-slate-200 animate-pulse" /></td>
      <td className="px-3 py-3.5"><div className="h-6 w-16 mx-auto rounded-full bg-slate-200 animate-pulse" /></td>
      <td className="px-3 py-3.5"><div className="h-8 w-16 mx-auto rounded bg-slate-200 animate-pulse" /></td>
    </tr>
  )
}

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
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Lấy tất cả sản phẩm
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, product_name, unit, status')
        .eq('status', 'ACTIVE')
        .order('product_name', { ascending: true })

      if (productsError) throw productsError

      // Lấy tất cả price_history để tính trend
      const { data: historyData, error: historyError } = await supabase
        .from('price_history')
        .select('product_id, import_date, unit_price_after_vat, suggested_retail_price, is_active_price')
        .order('import_date', { ascending: false })

      if (historyError) throw historyError

      // Xử lý dữ liệu để tính giá mới nhất và trend
      const priceMap = {}
      const prevPriceMap = {}

      historyData.forEach((h) => {
        const pid = h.product_id
        if (!priceMap[pid]) {
          priceMap[pid] = h
        }
      })

      // Lấy giá sát trước đó cho trend
      historyData.forEach((h, idx) => {
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

  useEffect(() => {
    fetchPriceBookFromSupabase()
  }, [fetchPriceBookFromSupabase])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((item) => {
      const name = String(item.product_name || '').toLowerCase()
      const unit = String(item.unit || '').toLowerCase()
      return name.includes(q) || unit.includes(q)
    })
  }, [products, query])

  useEffect(() => {
    setPage(1)
  }, [query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageItems = filtered.slice(start, start + PAGE_SIZE)

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
      // Cập nhật sản phẩm
      const { error: productError } = await supabase
        .from('products')
        .update({
          product_name: editingProduct.product_name,
          unit: editingProduct.unit,
        })
        .eq('id', editingProduct.id)

      if (productError) throw productError

      // Nếu có giá mới, thêm vào price_history
      const pd = priceData[editingProduct.id]
      if (editingProduct.latest_price > 0 && editingProduct.latest_price !== pd?.latest_price) {
        // Deactivate giá cũ
        await supabase
          .from('price_history')
          .update({ is_active_price: false })
          .eq('product_id', editingProduct.id)
          .eq('is_active_price', true)

        // Thêm giá mới
        const suggestedRetail = editingProduct.latest_price >= 2000
          ? Math.ceil(editingProduct.latest_price * 1.15 / 1000) * 1000
          : Math.ceil(editingProduct.latest_price * 1.15 / 100) * 100

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
      // Deactivate sản phẩm thay vì xóa
      const { error } = await supabase
        .from('products')
        .update({ trang_thai: 'INACTIVE' })
        .eq('id', deleteTarget.id)

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

  const startItem = filtered.length === 0 ? 0 : start + 1
  const endItem = Math.min(start + PAGE_SIZE, filtered.length)

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-brand-700 m-0">Tra cứu giá sản phẩm</h1>
        <p className="text-sm text-ink-muted mt-1 mb-0">
          Danh mục lịch sử giá nhập và biến động giá từ Supabase Cloud.
        </p>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên sản phẩm hoặc đơn vị tính..."
            className="input-base"
            style={{ minWidth: '280px' }}
          />
          <span className="text-sm text-ink-muted">
            {loading ? 'Đang tải...' : `${filtered.length} sản phẩm`}
          </span>
          <button
            type="button"
            className="btn btn-primary !text-xs ml-auto"
            onClick={fetchPriceBookFromSupabase}
            disabled={loading}
          >
            🔄 Làm mới
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block my-4 rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="w-full overflow-x-auto scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[700px] divide-y divide-slate-100 table-auto">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3.5 font-semibold text-slate-600">Tên sản phẩm</th>
                  <th className="text-center px-3 py-3.5 font-semibold text-slate-600">ĐVT</th>
                  <th className="text-center px-3 py-3.5 font-semibold text-slate-600">Giá nhập mới nhất</th>
                  <th className="text-center px-3 py-3.5 font-semibold text-slate-600">Giá bán lẻ gợi ý</th>
                  <th className="text-center px-3 py-3.5 font-semibold text-slate-600">Xu hướng</th>
                  <th className="text-center px-3 py-3.5 font-semibold text-slate-600">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    <SkeletonTableRow />
                    <SkeletonTableRow />
                    <SkeletonTableRow />
                  </>
                ) : pageItems.length > 0 ? (
                  pageItems.map((item) => {
                    const pd = priceData[item.id] || {}
                    const suggestedRetail = pd.latest_retail_price || (
                      pd.latest_price >= 2000
                        ? Math.ceil(pd.latest_price * 1.15 / 1000) * 1000
                        : Math.ceil(pd.latest_price * 1.15 / 100) * 100
                    )
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-slate-900">{item.product_name || '—'}</td>
                        <td className="text-center px-3 py-3.5 text-slate-600">{item.unit || '—'}</td>
                        <td className="text-center px-3 py-3.5 font-medium text-slate-800 number-cell">
                          {formatVndExact(Number(pd.latest_price) || 0)}
                        </td>
                        <td className="text-center px-3 py-3.5 font-medium text-blue-600 number-cell">
                          {formatVndExact(suggestedRetail)}
                        </td>
                        <td className="text-center px-3 py-3.5">
                          <TrendBadge trend={pd.trend} />
                        </td>
                        <td className="text-center px-3 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-700"
                              onClick={() => handleEdit(item)}
                              title="Sửa"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => setDeleteTarget(item)}
                              title="Xóa"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center text-ink-muted py-8">
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

        {/* Mobile Cards */}
        <div className="block md:hidden my-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : pageItems.length > 0 ? (
            pageItems.map((item) => {
              const pd = priceData[item.id] || {}
              const suggestedRetail = pd.latest_retail_price || (
                pd.latest_price >= 2000
                  ? Math.ceil(pd.latest_price * 1.15 / 1000) * 1000
                  : Math.ceil(pd.latest_price * 1.15 / 100) * 100
              )
              return (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-3 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{item.product_name || '—'}</span>
                    <TrendBadge trend={pd.trend} />
                  </div>
                  <div className="text-xs text-slate-500">
                    Đơn vị tính: {item.unit || '—'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-b border-slate-50 py-2 my-1">
                    <div>
                      <div className="text-xs text-slate-400">Giá nhập / ĐVT</div>
                      <div className="font-medium text-slate-700 text-sm">{formatVndExact(Number(pd.latest_price) || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-500 font-medium">Giá bán / ĐVT</div>
                      <div className="font-bold text-blue-600 text-base">{formatVndExact(suggestedRetail)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      onClick={() => handleEdit(item)}
                    >
                      ✏️ Sửa
                    </button>
                    <button
                      type="button"
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
                      onClick={() => setDeleteTarget(item)}
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-xl border border-slate-100 bg-white p-6 text-center text-ink-muted">
              Chưa có dữ liệu giá sản phẩm.
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm text-ink-muted">
              Hiển thị {startItem}–{endItem} trên tổng số {filtered.length} sản phẩm
            </p>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <button
                type="button"
                className="btn px-2 py-1.5 text-xs md:px-4 md:py-2 md:text-sm"
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
              >
                ⏮
              </button>
              <button
                type="button"
                className="btn px-2 py-1.5 text-xs md:px-3 md:py-2 md:text-sm"
                disabled={safePage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ◀
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1]
                  const showDots = prev && p - prev > 1
                  return (
                    <span key={p} className="contents">
                      {showDots && <span className="px-2 text-slate-400">...</span>}
                      <button
                        type="button"
                        className={`btn px-2 py-1.5 text-xs md:px-3 md:py-2 md:text-sm ${p === safePage ? 'btn-primary' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    </span>
                  )
                })}
              <button
                type="button"
                className="btn px-2 py-1.5 text-xs md:px-3 md:py-2 md:text-sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                ▶
              </button>
              <button
                type="button"
                className="btn px-2 py-1.5 text-xs md:px-4 md:py-2 md:text-sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                ⏭
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsEditModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">✏️ Chỉnh sửa sản phẩm</h3>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setIsEditModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="form-group">
                <label className="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm</label>
                <input
                  type="text"
                  value={editingProduct.product_name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, product_name: e.target.value })}
                  className="input-base"
                />
              </div>

              <div className="form-group">
                <label className="mb-1 block text-sm font-medium text-slate-700">Đơn vị tính</label>
                <input
                  type="text"
                  value={editingProduct.unit}
                  onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                  className="input-base"
                />
              </div>

              <div className="form-group">
                <label className="mb-1 block text-sm font-medium text-slate-700">Đơn giá nhập sau VAT (VND)</label>
                <input
                  type="number"
                  value={editingProduct.latest_price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, latest_price: Number(e.target.value) || 0 })}
                  className="input-base"
                />
                {editingProduct.latest_price > 0 && (
                  <p className="mt-1.5 text-xs text-blue-600">
                    ➔ Giá bán lẻ gợi ý: {
                      (editingProduct.latest_price >= 2000
                        ? Math.ceil(editingProduct.latest_price * 1.15 / 1000) * 1000
                        : Math.ceil(editingProduct.latest_price * 1.15 / 100) * 100
                      ).toLocaleString('vi-VN')
                    }đ
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn" onClick={() => setIsEditModalOpen(false)}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveEditProduct}
                disabled={saving}
              >
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="card w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900">Xác nhận xóa sản phẩm</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Bạn có chắc chắn muốn ẩn sản phẩm <span className="font-semibold text-slate-900">{deleteTarget.product_name}</span> khỏi danh mục tra cứu?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>Hủy</button>
              <button type="button" className="btn btn-primary" onClick={handleDelete} disabled={saving}>
                {saving ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  )
}
