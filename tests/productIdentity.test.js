import test from 'node:test'
import assert from 'node:assert/strict'

import { separateProductIdentity } from '../src/lib/productIdentity.js'
import { filterPriceBook, mapPriceBook } from '../src/lib/priceBook.js'

const REAL_INVOICE_FIXTURE = {
  productCode: '01SB10',
  ocrName: '01sb10-creamer đặc có đường NSPN XANH biển 1284G.',
  productName: 'Creamer đặc có đường NSPN XANH biển 1284G.',
  unit: 'Thùng',
  purchasePrice: 55404,
  suggestedRetailPrice: 64000,
}

test('INO23637 keeps the real SKU separate from its human-readable name', () => {
  assert.deepEqual(
    separateProductIdentity(REAL_INVOICE_FIXTURE.productCode, REAL_INVOICE_FIXTURE.ocrName),
    {
      productCode: REAL_INVOICE_FIXTURE.productCode,
      productName: REAL_INVOICE_FIXTURE.productName,
    }
  )
})

test('does not guess from arbitrary hyphenated names or OCR-confused codes', () => {
  assert.equal(separateProductIdentity('', 'Sữa-chua có đường').productName, 'Sữa-chua có đường')
  assert.equal(
    separateProductIdentity('O1SB1O', REAL_INVOICE_FIXTURE.ocrName).productName,
    REAL_INVOICE_FIXTURE.ocrName
  )
})

test('price book preserves and searches the separate SKU', () => {
  const items = mapPriceBook(
    [{ id: 'fixture-a', product_code: REAL_INVOICE_FIXTURE.productCode, product_name: REAL_INVOICE_FIXTURE.productName, unit: REAL_INVOICE_FIXTURE.unit, status: 'ACTIVE' }],
    [{ id: 'history-a', product_id: 'fixture-a', unit_price_after_vat: REAL_INVOICE_FIXTURE.purchasePrice, suggested_retail_price: REAL_INVOICE_FIXTURE.suggestedRetailPrice, is_active_price: true }]
  )

  assert.deepEqual(items[0], {
    id: 'fixture-a',
    product_code: REAL_INVOICE_FIXTURE.productCode,
    product_name: REAL_INVOICE_FIXTURE.productName,
    unit: REAL_INVOICE_FIXTURE.unit,
    status: 'ACTIVE',
    purchase_price: REAL_INVOICE_FIXTURE.purchasePrice,
    suggested_retail_price: REAL_INVOICE_FIXTURE.suggestedRetailPrice,
  })
  assert.equal(filterPriceBook(items, '01sb10').length, 1)
})
