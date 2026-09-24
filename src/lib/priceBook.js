// Trusted boundary for the price lookup screen. Keep source fields explicit and
// avoid deriving product metadata or prices in the UI.
export const PRICE_BOOK_PRODUCT_FIELDS = 'id, product_code, product_name, unit, status'
export const PRICE_BOOK_HISTORY_FIELDS = 'id, product_id, import_date, unit_price_after_vat, suggested_retail_price, is_active_price'

export function normalizeSearch(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

export function mapPriceBook(products = [], histories = [], { status = 'ACTIVE' } = {}) {
  const latestByProduct = new Map()
  for (const history of histories) {
    if (!history?.product_id || history.is_active_price !== true || latestByProduct.has(history.product_id)) continue
    latestByProduct.set(history.product_id, history)
  }

  const seen = new Set()
  return products.reduce((result, product) => {
    if (!product?.id || product.status !== status || seen.has(product.id)) return result
    seen.add(product.id)
    const price = latestByProduct.get(product.id)
    result.push({
      id: product.id,
      product_code: product.product_code ?? '',
      product_name: product.product_name ?? '',
      unit: product.unit ?? '',
      status: product.status,
      purchase_price: price?.unit_price_after_vat ?? null,
      suggested_retail_price: price?.suggested_retail_price ?? null,
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
  const productsResult = await client
    .from('products')
    .select(PRICE_BOOK_PRODUCT_FIELDS)
    .eq('status', status)
    .order('product_name', { ascending: true })
  if (productsResult.error) throw productsResult.error

  const historyResult = await client
    .from('price_history')
    .select(PRICE_BOOK_HISTORY_FIELDS)
    .eq('is_active_price', true)
    .order('import_date', { ascending: false })
    .order('id', { ascending: false })
  if (historyResult.error) throw historyResult.error

  return mapPriceBook(productsResult.data || [], historyResult.data || [], { status })
}
