import { PRODUCT_RESOLUTION, preflightProductItems, resolveProduct } from './productResolver.js'

export function createSupabaseProductRepository(client) {
  return {
    async listProducts() {
      const { data, error } = await client
        .from('products')
        .select('id, product_code, product_name, unit, status, group_key')
        .eq('status', 'ACTIVE')
      if (error) throw error
      return data || []
    },

    async insertProduct(product) {
      const { data, error } = await client.from('products').insert([product]).select().single()
      if (error) throw error
      return data
    },

    async findInvoiceHistory(productId, invoiceId) {
      const { data, error } = await client
        .from('price_history')
        .select('id')
        .eq('product_id', productId)
        .eq('invoice_id', invoiceId)
        .limit(1)
      if (error) throw error
      return data?.[0] || null
    },

    async insertHistory(history) {
      const { data, error } = await client.from('price_history').insert([history]).select('id').single()
      if (error) throw error
      return data
    },

    async deactivateOtherHistory(productId, activeHistoryId) {
      const { error } = await client
        .from('price_history')
        .update({ is_active_price: false })
        .eq('product_id', productId)
        .eq('is_active_price', true)
        .neq('id', activeHistoryId)
      if (error) throw error
    },
  }
}

export async function preflightInvoiceProducts(repository, items = []) {
  const products = await repository.listProducts()
  const rows = preflightProductItems(items, products)
  return {
    products,
    rows,
    ambiguous: rows.filter(row => row.resolution.status === PRODUCT_RESOLUTION.AMBIGUOUS),
  }
}

export async function importInvoiceProducts({
  repository,
  invoiceId,
  importDate,
  items = [],
  groupKey,
  suggestedPriceFor,
}) {
  const catalog = await repository.listProducts()
  const preview = preflightProductItems(items, catalog)
  const ambiguous = preview.filter(row => row.resolution.status === PRODUCT_RESOLUTION.AMBIGUOUS)
  if (ambiguous.length) {
    return { status: PRODUCT_RESOLUTION.AMBIGUOUS, ambiguous, results: [] }
  }

  const results = []
  for (const item of items) {
    // Final deterministic duplicate check immediately before any product
    // insert. This also sees a product created by an earlier line or another
    // importer after preflight completed.
    const latestCatalog = await repository.listProducts()
    let resolution = resolveProduct(item, latestCatalog)
    if (resolution.status === PRODUCT_RESOLUTION.AMBIGUOUS) {
      return { status: PRODUCT_RESOLUTION.AMBIGUOUS, ambiguous: [{ item, resolution }], results }
    }
    let product = resolution.product

    if (resolution.status === PRODUCT_RESOLUTION.NEW_PRODUCT) {
      product = await repository.insertProduct({
        ...resolution.proposedProduct,
        group_key: groupKey || 'Hàng hóa tổng hợp',
        status: 'ACTIVE',
      })
      resolution = { ...resolution, product }
    }

    const existingHistory = await repository.findInvoiceHistory(product.id, invoiceId)
    if (existingHistory) {
      results.push({ resolution, product, history: existingHistory, historyCreated: false })
      continue
    }

    const rawRowType = String(item.row_type || item.rowType || '').trim().toUpperCase()
    const rowType = rawRowType === 'KM' || rawRowType === 'MUA'
      ? rawRowType
      : Number(item.unit_price_after_vat || item.don_gia_sau_vat) === 0 ? 'KM' : 'MUA'
    const history = await repository.insertHistory({
      product_id: product.id,
      invoice_id: invoiceId,
      import_date: importDate,
      unit_price_after_vat: Number(item.unit_price_after_vat ?? item.don_gia_sau_vat) || 0,
      quantity: Number(item.quantity ?? item.so_luong) || 0,
      row_type: rowType,
      suggested_retail_price: suggestedPriceFor(item),
      is_active_price: true,
    })
    await repository.deactivateOtherHistory(product.id, history.id)
    results.push({ resolution, product, history, historyCreated: true })
  }

  return { status: 'COMPLETED', ambiguous: [], results }
}
