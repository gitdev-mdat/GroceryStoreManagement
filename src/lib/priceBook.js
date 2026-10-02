import { summarizeVatSources } from './vatSources.js'

// Trusted boundary for the price lookup screen. Keep source fields explicit and
// avoid deriving product metadata or prices in the UI.
export const PRICE_BOOK_PRODUCT_FIELDS = 'id, product_code, product_name, unit, status'
export const PRICE_BOOK_HISTORY_FIELDS = 'id, product_id, invoice_id, import_date, unit_price_after_vat, suggested_retail_price, is_active_price, invoices(id, invoice_number, serial_number, issue_date, invoice_type)'

export function normalizeSearch(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

export function mapPriceBook(products = [], histories = [], { status = 'ACTIVE', sourceSummaries = [] } = {}) {
  const latestByProduct = new Map()
  const historiesByProduct = new Map()
  const summaryByProduct = new Map(sourceSummaries.map(summary => [summary.product_id, summary]))
  for (const history of histories) {
    if (!history?.product_id) continue
    if (!historiesByProduct.has(history.product_id)) historiesByProduct.set(history.product_id, [])
    historiesByProduct.get(history.product_id).push(history)
    if (history.is_active_price === true && !latestByProduct.has(history.product_id)) latestByProduct.set(history.product_id, history)
  }

  const seen = new Set()
  return products.reduce((result, product) => {
    if (!product?.id || product.status !== status || seen.has(product.id)) return result
    seen.add(product.id)
    const price = latestByProduct.get(product.id)
    const derivedSummary = summarizeVatSources(historiesByProduct.get(product.id) || [])
    const apiSummary = summaryByProduct.get(product.id)
    const sourceSummary = apiSummary ? {
      vatSourceCount: Number(apiSummary.vat_source_count || 0),
      currentPriceSource: apiSummary.current_invoice_id ? {
        invoiceId: apiSummary.current_invoice_id,
        invoiceNumber: apiSummary.current_invoice_number || '',
        invoiceDate: apiSummary.current_invoice_date || '',
        isCurrentPriceSource: true,
        available: true,
      } : null,
    } : derivedSummary
    result.push({
      id: product.id,
      product_code: product.product_code ?? '',
      product_name: product.product_name ?? '',
      unit: product.unit ?? '',
      status: product.status,
      purchase_price: price?.unit_price_after_vat ?? null,
      suggested_retail_price: price?.suggested_retail_price ?? null,
      vat_source_count: sourceSummary.vatSourceCount,
      current_price_source: sourceSummary.currentPriceSource,
    })
    return result
  }, [])
}

export function filterPriceBook(items, query) {
  const normalizedQuery = normalizeSearch(query)
  if (!normalizedQuery) return items
  return items.filter(item =>
    normalizeSearch(item.product_name).includes(normalizedQuery) ||
    normalizeSearch(item.product_code).includes(normalizedQuery)
  )
}

export function formatStoredVnd(value, formatter) {
  return value == null || value === '' ? 'Chưa có' : `${formatter(Number(value))} ₫`
}

export async function queryPriceBook(client, { status = 'ACTIVE' } = {}) {
  const summaryRequest = (async () => {
    try {
      return await client.rpc('get_product_vat_source_summaries', { p_status: status })
    } catch (error) {
      return { data: null, error }
    }
  })()
  const [productsResult, historyResult, summaryResult] = await Promise.all([
    client.from('products').select(PRICE_BOOK_PRODUCT_FIELDS).eq('status', status).order('product_name', { ascending: true }),
    client.from('price_history').select(PRICE_BOOK_HISTORY_FIELDS).eq('is_active_price', true).order('import_date', { ascending: false }).order('id', { ascending: false }),
    summaryRequest,
  ])
  if (productsResult.error) throw productsResult.error
  if (historyResult.error) throw historyResult.error
  const summaryError = summaryResult?.error || null

  // VAT traceability enriches the price book, but it must never become a
  // dependency for the core product/price list. This also keeps deployments
  // safe while PostgREST refreshes its schema cache after the RPC migration.
  if (summaryError) {
    console.warn('[priceBook] VAT source summary unavailable; using active-price metadata only.', {
      code: summaryError.code,
      message: summaryError.message,
    })
  }

  return mapPriceBook(productsResult.data || [], historyResult.data || [], {
    status,
    sourceSummaries: summaryError ? [] : (summaryResult?.data || []),
  })
}
