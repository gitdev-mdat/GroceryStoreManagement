import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatDateDisplay } from '../components/FormatDate'
import { formatVndExact } from '../components/FormatNumber'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const PAGE_SIZE = 10

function SkeletonRow({ cols = 8 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-5 rounded bg-slate-200 animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

function MobileCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="h-5 w-3/4 rounded bg-slate-200 animate-pulse mb-2" />
      <div className="h-4 w-1/2 rounded bg-slate-200 animate-pulse mb-3" />
      <div className="h-4 w-full rounded bg-slate-200 animate-pulse mb-3" />
      <div className="h-10 w-full rounded bg-slate-200 animate-pulse" />
    </div>
  )
}

function calculateSmartRetailPrice(price) {
  if (!price || price <= 0) return 0
  if (price >= 2000) {
    return Math.ceil(price * 1.15 / 1000) * 1000
  }
  return Math.ceil(price * 1.15 / 100) * 100
}

function generateMonthOptions() {
  const options = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, currentMonth - i, 1)
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    const value = `${year}-${String(month).padStart(2, '0')}`
    const label = `Tháng ${String(month).padStart(2, '0')}/${year}`
    options.push({ value, label })
  }
  return options
}

const MONTH_OPTIONS = generateMonthOptions()

export default function NhatKyHoaDon() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  // Filter states
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterType, setFilterType] = useState('ALL') // 'ALL', 'VAT', 'RETAIL'

  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null)
  const [invoiceProducts, setInvoiceProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [viewerImage, setViewerImage] = useState(null)

  const { showToast, ToastContainer } = useToast()

  const fetchInvoices = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let queryBuilder = supabase
        .from('invoices')
        .select(`
          id,
          serial_number,
          invoice_number,
          issue_date,
          invoice_type,
          total_amount,
          notes,
          image_url,
          supplier_id,
          suppliers (
            company_name,
            tax_code
          )
        `)
        .order('issue_date', { ascending: false })

      // Apply month filter
      if (filterMonth) {
        const [year, month] = filterMonth.split('-')
        const startDate = `${year}-${month}-01`
        const endDate = month === '12'
          ? `${parseInt(year) + 1}-01-01`
          : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`
        queryBuilder = queryBuilder.gte('issue_date', startDate).lt('issue_date', endDate)
      }

      // Apply type filter
      if (filterType === 'VAT') {
        queryBuilder = queryBuilder.eq('invoice_type', 'VAT')
      } else if (filterType === 'RETAIL') {
        queryBuilder = queryBuilder.eq('invoice_type', 'RETAIL')
      }

      const { data, error } = await queryBuilder

      if (error) throw error
      setInvoices(data || [])

      // Reset page when filters change
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

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return invoices.filter((row) => {
      if (!q) return true
      const supplier = row.suppliers || {}
      return (
        (row.serial_number || '').toLowerCase().includes(q) ||
        (row.invoice_number || '').toLowerCase().includes(q) ||
        (row.invoice_type || '').toLowerCase().includes(q) ||
        (supplier.company_name || '').toLowerCase().includes(q) ||
        (supplier.tax_code || '').toLowerCase().includes(q) ||
        (row.notes || '').toLowerCase().includes(q)
      )
    })
  }, [invoices, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleToggleExpand = async (invoiceId) => {
    if (expandedInvoiceId === invoiceId) {
      setExpandedInvoiceId(null)
      setInvoiceProducts([])
      return
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
    } catch (err) {
      console.error('Lỗi fetch sản phẩm:', err)
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
      const invoiceDisplay = invoice?.invoice_number || invoice?.serial_number || `HĐ ${deleteId.slice(0, 8)}`

      await supabase.from('price_history').delete().eq('invoice_id', deleteId)
      const { error } = await supabase.from('invoices').delete().eq('id', deleteId)

      if (error) throw error

      setInvoices(prev => prev.filter(i => i.id !== deleteId))
      showToast(`Đã xóa hóa đơn ${invoiceDisplay}`, 'success')
    } catch (err) {
      console.error('Lỗi xóa:', err)
      showToast('Không thể xóa hóa đơn. Vui lòng thử lại.', 'error')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const deleteDialogInvoice = deleteId ? invoices.find(i => i.id === deleteId) : null
  const deleteDialogDisplay = deleteDialogInvoice?.invoice_number || deleteDialogInvoice?.serial_number || ''

  const handleFilterMonthChange = (e) => {
    setFilterMonth(e.target.value)
  }

  const handleFilterTypeChange = (type) => {
    setFilterType(type)
  }

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-brand-700 m-0">Nhật ký hóa đơn</h1>
        <p className="text-sm text-ink-muted mt-1 mb-0">
          Danh sách toàn bộ hóa đơn đã nhập từ Supabase Cloud.
        </p>
      </div>

      <div className="card">
        {/* Search & Filter Row */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Tìm theo tên công ty, MST, số/ký hiệu hóa đơn..."
            className="input-base"
            style={{ minWidth: '280px' }}
          />
          <button
            type="button"
            className="btn btn-primary !text-xs"
            onClick={fetchInvoices}
            disabled={loading}
          >
            🔄 Làm mới
          </button>
        </div>

        {/* Smart Filter Bar */}
        <div className="flex flex-col gap-2 my-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          {/* Filter Row 1: Month Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-600">Thời gian:</label>
            <select
              value={filterMonth}
              onChange={handleFilterMonthChange}
              className="input-base !py-2 !px-3 !text-sm rounded-lg border-slate-300 focus:border-brand-500 focus:ring-brand-500"
            >
              {MONTH_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Filter Row 2: Type Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Loại chứng từ:</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleFilterTypeChange('ALL')}
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterType === 'ALL'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => handleFilterTypeChange('VAT')}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterType === 'VAT'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                 VAT
              </button>
              <button
                type="button"
                onClick={() => handleFilterTypeChange('RETAIL')}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterType === 'RETAIL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                 Bán lẻ
              </button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-ink-muted mb-3">
          {loading ? 'Đang tải...' : `${filtered.length} hóa đơn`}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Ngày xuất</th>
                <th>Loại</th>
                <th>Tên nhà cung cấp</th>
                <th>MST</th>
                <th>Ký hiệu</th>
                <th>Số hóa đơn</th>
                <th className="number-cell">Số tiền (VND)</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow cols={8} />
                  <SkeletonRow cols={8} />
                  <SkeletonRow cols={8} />
                </>
              ) : pageItems.length > 0 ? (
                pageItems.map((row) => {
                  const supplier = row.suppliers || {}
                  const displayName = supplier.company_name || null
                  const displayMst = supplier.tax_code
                  const displaySymbol = row.serial_number || null
                  const displayInvoiceNumber = row.invoice_number || null

                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td>{row.issue_date ? formatDateDisplay(row.issue_date) : '—'}</td>
                      <td>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.invoice_type === 'RETAIL' ? 'bg-blue-100 text-blue-700' : 'bg-brand-100 text-brand-700'
                        }`}>
                          {row.invoice_type === 'RETAIL' ? '🛒 Bán lẻ' : '📑 VAT'}
                        </span>
                      </td>
                      <td>
                        {displayName
                          ? displayName
                          : <span className="text-slate-400 italic">Mua lẻ / Không có thông tin</span>
                        }
                      </td>
                      <td>{displayMst && displayMst !== 'null' && displayMst !== '' ? displayMst : '—'}</td>
                      <td>{displaySymbol && displaySymbol !== 'null' ? displaySymbol : '—'}</td>
                      <td>{displayInvoiceNumber && displayInvoiceNumber !== 'null' ? displayInvoiceNumber : '—'}</td>
                      <td className="number-cell">{formatVndExact(Number(row.total_amount) || 0)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          {row.image_url && (
                            <button
                              type="button"
                              className="btn !text-xs"
                              onClick={() => setViewerImage(row.image_url)}
                              title="Xem ảnh hóa đơn"
                            >
                              🖼️
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-danger !text-xs"
                            onClick={() => setDeleteId(row.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center text-ink-muted py-8">
                    {isSupabaseConfigured()
                      ? 'Không có hóa đơn nào trong tháng này.'
                      : 'Chưa kết nối Supabase. Vui lòng cấu hình .env.local'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden space-y-3 mt-4">
          {loading ? (
            <>
              <MobileCardSkeleton />
              <MobileCardSkeleton />
              <MobileCardSkeleton />
            </>
          ) : pageItems.length > 0 ? (
            pageItems.map((row) => {
              const supplier = row.suppliers || {}
              const isExpanded = expandedInvoiceId === row.id
              const displayName = supplier.company_name
              const displayMst = supplier.tax_code
              const displayInvoiceNumber = row.invoice_number || row.serial_number

              return (
                <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {displayName || <span className="text-slate-400 italic">Mua lẻ / Không có thông tin</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {row.issue_date ? formatDateDisplay(row.issue_date) : '—'}
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.invoice_type === 'RETAIL'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-brand-100 text-brand-700'
                    }`}>
                      {row.invoice_type === 'RETAIL' ? 'Bán lẻ' : 'VAT'}
                    </span>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    {displayMst && displayMst !== 'null' && displayMst !== '' ? (
                      <div className="text-slate-600">
                        <span className="text-slate-400">MST:</span> {displayMst}
                      </div>
                    ) : (
                      <div />
                    )}
                    <div className="text-slate-600">
                      <span className="text-slate-400">Số HĐ:</span> {displayInvoiceNumber || '—'}
                    </div>
                    <div className="text-slate-600 col-span-2">
                      <span className="text-slate-400">Tổng tiền:</span>{' '}
                      <span className="font-medium">{formatVndExact(Number(row.total_amount) || 0)}</span>
                    </div>
                  </div>

                  {/* Action Buttons - Aligned heights */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn !text-xs flex-1 h-10 flex items-center justify-center gap-1"
                      onClick={() => handleToggleExpand(row.id)}
                    >
                      📋 {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                    </button>
                    {row.image_url && (
                      <button
                        type="button"
                        className="btn !text-xs h-10 flex items-center justify-center"
                        onClick={() => setViewerImage(row.image_url)}
                        title="Xem ảnh hóa đơn"
                      >
                        🖼️
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger !text-xs h-10 flex items-center justify-center"
                      onClick={() => setDeleteId(row.id)}
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Expanded Products List */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2">
                      {isLoadingProducts ? (
                        <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="h-14 rounded bg-slate-200 animate-pulse" />
                          ))}
                        </div>
                      ) : invoiceProducts.length > 0 ? (
                        <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-slate-700">
                              📦 Chi tiết sản phẩm
                            </h4>
                            <span className="text-xs text-slate-500">
                              {invoiceProducts.length} mặt hàng
                            </span>
                          </div>
                          {invoiceProducts.map((item, idx) => {
                            const retailPrice = calculateSmartRetailPrice(item.unit_price_after_vat)
                            const isGift = item.row_type === 'KM'
                            return (
                              <div
                                key={item.id}
                                className={`bg-white rounded-lg p-3 border border-slate-100 ${
                                  isGift ? 'border-amber-200 bg-amber-50/30' : ''
                                }`}
                              >
                                {/* Row 1: Tên hàng - Số lượng */}
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400 font-medium text-xs">{idx + 1}.</span>
                                    <span className="font-medium text-slate-800">
                                      {item.products?.product_name || '—'}
                                    </span>
                                    {isGift && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                        🎁 Quà tặng (0đ)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-slate-600">
                                    SL: <span className="font-medium">{(item.quantity || 0).toLocaleString('vi-VN')}</span>{' '}
                                    <span className="text-slate-400">{item.products?.unit || '—'}</span>
                                  </div>
                                </div>

                                {/* Row 2: Giá nhập - Giá bán lẻ */}
                                {!isGift && (
                                  <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-100">
                                    <div className="text-sm">
                                      <span className="text-slate-400">Giá nhập: </span>
                                      <span className="font-medium text-slate-700">
                                        {Number(item.unit_price_after_vat || 0).toLocaleString('vi-VN')}đ
                                      </span>
                                    </div>
                                    <div className="text-sm">
                                      <span className="text-blue-500">Gợi ý bán lẻ: </span>
                                      <span className="font-bold text-blue-600">
                                        {retailPrice.toLocaleString('vi-VN')}đ
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-4 rounded-lg text-center text-sm text-slate-500">
                          Không có sản phẩm nào trong hóa đơn này.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="text-center text-slate-500 py-8">
              Không có hóa đơn nào trong tháng này.
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-2">
              <button type="button" className="btn" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                ◀ Trước
              </button>
              <span className="text-sm text-ink-muted self-center">
                Trang {page + 1} / {totalPages}
              </span>
              <button type="button" className="btn" disabled={page + 1 >= totalPages} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
                Sau ▶
              </button>
            </div>
            {query && (
              <button type="button" className="btn !text-xs" onClick={() => setQuery('')}>
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="🗑️ Xóa hóa đơn"
        variant="danger"
        loading={deleting}
      >
        <p className="mb-2">
          Bạn có chắc chắn muốn xóa hóa đơn{deleteDialogDisplay ? ` số ${deleteDialogDisplay}` : ''}?
        </p>
        <p className="text-sm text-amber-600">
          ⚠️ Hành động này sẽ xóa toàn bộ sản phẩm đi kèm trong hóa đơn. Không thể hoàn tác.
        </p>
      </ConfirmDialog>

      <ToastContainer />

      {viewerImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewerImage(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl rounded-2xl bg-black p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/70">📄 Xem ảnh hóa đơn</span>
              <button
                type="button"
                className="rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
                onClick={() => setViewerImage(null)}
              >
                ✕ Đóng
              </button>
            </div>
            <img
              src={viewerImage}
              alt="Ảnh hóa đơn"
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
