import test from 'node:test'
import assert from 'node:assert/strict'

import { invoiceDetailHref, summarizeVatSources } from '../src/lib/vatSources.js'
import { mapPriceBook, queryPriceBook } from '../src/lib/priceBook.js'

const product = (id, status = 'ACTIVE') => ({ id, product_code: id, product_name: 'AFC lúa mì', unit: 'Hộp', status })
const history = (productId, invoiceId, date, price, extra = {}) => ({
  id: `${productId}-${invoiceId}`,
  product_id: productId,
  invoice_id: invoiceId,
  import_date: date,
  unit_price_after_vat: price,
  suggested_retail_price: price + 4000,
  is_active_price: false,
  invoices: {
    id: invoiceId,
    invoice_number: `HD-${invoiceId}`,
    issue_date: date,
    invoice_type: 'VAT',
    suppliers: { company_name: `Supplier ${invoiceId}` },
  },
  ...extra,
})

test('product with zero VAT sources renders with no invalid navigation target', () => {
  const [row] = mapPriceBook([product('p0')], [])
  assert.equal(row.vat_source_count, 0)
  assert.equal(row.current_price_source, null)
  assert.equal(invoiceDetailHref(null, row.id), null)
})

test('one VAT source identifies and opens the exact current invoice', () => {
  const one = history('p1', 'invoice-1', '2026-08-29', 23001, { is_active_price: true })
  const [row] = mapPriceBook([product('p1')], [one])
  assert.equal(row.vat_source_count, 1)
  assert.equal(row.current_price_source.invoiceId, 'invoice-1')
  assert.equal(row.current_price_source.invoiceNumber, 'HD-invoice-1')
  assert.equal(row.current_price_source.invoiceDate, '2026-08-29')
  assert.equal(row.current_price_source.supplierName, 'Supplier invoice-1')
  assert.equal(invoiceDetailHref(row.current_price_source, row.id), '/nhat-ky-hoa-don?invoiceId=invoice-1&productId=p1&source=price-book')
})

test('three VAT sources are newest first and each keeps its own invoice ID', () => {
  const sources = summarizeVatSources([
    history('p3', 'old', '2026-08-02', 22000),
    history('p3', 'new', '2026-08-29', 23001, { is_active_price: true }),
    history('p3', 'middle', '2026-08-17', 22500),
  ]).sources
  assert.deepEqual(sources.map(source => source.invoiceId), ['new', 'middle', 'old'])
  assert.deepEqual(sources.map(source => invoiceDetailHref(source, 'p3')), [
    '/nhat-ky-hoa-don?invoiceId=new&productId=p3&source=price-book',
    '/nhat-ky-hoa-don?invoiceId=middle&productId=p3&source=price-book',
    '/nhat-ky-hoa-don?invoiceId=old&productId=p3&source=price-book',
  ])
})

test('identical product names never cross-link different product IDs', () => {
  const rows = mapPriceBook(
    [product('product-a'), product('product-b')],
    [history('product-a', 'invoice-a', '2026-08-01', 10000, { is_active_price: true }), history('product-b', 'invoice-b', '2026-08-02', 20000, { is_active_price: true })]
  )
  assert.equal(rows.find(row => row.id === 'product-a').current_price_source.invoiceId, 'invoice-a')
  assert.equal(rows.find(row => row.id === 'product-b').current_price_source.invoiceId, 'invoice-b')
})

test('removed invoice remains unavailable and is never substituted', () => {
  const missing = history('p5', 'removed', '2026-08-10', 12000, { invoices: null, is_active_price: true })
  const summary = summarizeVatSources([missing])
  assert.equal(summary.currentPriceSource.invoiceId, 'removed')
  assert.equal(summary.currentPriceSource.available, false)
  assert.equal(invoiceDetailHref(summary.currentPriceSource, 'p5'), null)
})

test('hidden product keeps VAT source lookup data', () => {
  const [row] = mapPriceBook([product('hidden', 'INACTIVE')], [history('hidden', 'invoice-hidden', '2026-08-12', 15000, { is_active_price: true })], { status: 'INACTIVE' })
  assert.equal(row.status, 'INACTIVE')
  assert.equal(row.current_price_source.invoiceId, 'invoice-hidden')
})

test('lightweight API summary supplies count and current source without loading full history', () => {
  const [row] = mapPriceBook(
    [product('summary-product')],
    [history('summary-product', 'current-invoice', '2026-08-29', 23001, { is_active_price: true })],
    { sourceSummaries: [{ product_id: 'summary-product', vat_source_count: 4, current_invoice_id: 'current-invoice', current_invoice_number: '00017114', current_invoice_date: '2026-08-29' }] }
  )
  assert.equal(row.vat_source_count, 4)
  assert.deepEqual(row.current_price_source, {
    invoiceId: 'current-invoice',
    invoiceNumber: '00017114',
    invoiceDate: '2026-08-29',
    isCurrentPriceSource: true,
    available: true,
  })
})

function resultBuilder(result) {
  const builder = {
    select() { return builder },
    eq() { return builder },
    order() { return builder },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject) },
  }
  return builder
}

test('PGRST202 from optional VAT RPC never hides the core product list', async () => {
  const coreProduct = product('rpc-fallback')
  const activeHistory = history('rpc-fallback', 'known-invoice', '2026-08-29', 23001, { is_active_price: true })
  const client = {
    from(table) {
      if (table === 'products') return resultBuilder({ data: [coreProduct], error: null })
      if (table === 'price_history') return resultBuilder({ data: [activeHistory], error: null })
      throw new Error(`Unexpected table ${table}`)
    },
    rpc(name, args) {
      assert.equal(name, 'get_product_vat_source_summaries')
      assert.deepEqual(args, { p_status: 'ACTIVE' })
      return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Function missing from schema cache' } })
    },
  }

  const originalWarn = console.warn
  const warnings = []
  console.warn = (...args) => warnings.push(args)
  try {
    const rows = await queryPriceBook(client)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 'rpc-fallback')
    assert.equal(rows[0].purchase_price, 23001)
    assert.equal(rows[0].current_price_source.invoiceId, 'known-invoice')
    assert.equal(warnings.length, 1)
    assert.equal(warnings[0][1].code, 'PGRST202')
  } finally {
    console.warn = originalWarn
  }
})
