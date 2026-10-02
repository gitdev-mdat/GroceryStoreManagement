export const VAT_SOURCE_HISTORY_FIELDS = [
  'id',
  'product_id',
  'invoice_id',
  'import_date',
  'unit_price_after_vat',
  'quantity',
  'row_type',
  'is_active_price',
  'invoices(id, invoice_number, serial_number, issue_date, invoice_type, suppliers(company_name, tax_code))',
].join(', ')

const timestamp = value => {
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

export function toVatSource(history) {
  if (!history?.invoice_id) return null
  const invoice = history.invoices || null
  if (invoice && invoice.invoice_type && invoice.invoice_type !== 'VAT') return null
  return {
    historyId: history.id,
    productId: history.product_id,
    invoiceId: history.invoice_id,
    invoiceNumber: invoice?.invoice_number || invoice?.serial_number || '',
    invoiceDate: invoice?.issue_date || history.import_date || '',
    supplierName: invoice?.suppliers?.company_name || '',
    supplierTaxCode: invoice?.suppliers?.tax_code || '',
    purchasePrice: history.unit_price_after_vat ?? null,
    quantity: history.quantity ?? null,
    rowType: history.row_type || '',
    isCurrentPriceSource: history.is_active_price === true,
    available: Boolean(invoice?.id),
  }
}

export function summarizeVatSources(histories = []) {
  const unique = new Map()
  for (const history of histories) {
    const source = toVatSource(history)
    if (!source) continue
    const existing = unique.get(source.invoiceId)
    if (!existing || source.isCurrentPriceSource) unique.set(source.invoiceId, source)
  }
  const sources = [...unique.values()].sort((a, b) => (
    timestamp(b.invoiceDate) - timestamp(a.invoiceDate) || String(b.invoiceId).localeCompare(String(a.invoiceId))
  ))
  return {
    vatSourceCount: sources.length,
    currentPriceSource: sources.find(source => source.isCurrentPriceSource) || null,
    sources,
  }
}

export async function queryProductVatSources(client, productId) {
  const { data, error } = await client
    .from('price_history')
    .select(VAT_SOURCE_HISTORY_FIELDS)
    .eq('product_id', productId)
    .order('import_date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return summarizeVatSources(data || []).sources
}

export function invoiceDetailHref(source, productId) {
  if (!source?.available || !source.invoiceId) return null
  const params = new URLSearchParams({ invoiceId: source.invoiceId })
  if (productId) params.set('productId', productId)
  params.set('source', 'price-book')
  return `/nhat-ky-hoa-don?${params.toString()}`
}
