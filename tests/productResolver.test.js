import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PRODUCT_RESOLUTION,
  normalizeSourceProduct,
  normalizeUnitDisplay,
  resolveProduct,
} from '../src/lib/productResolver.js'
import { importInvoiceProducts } from '../src/lib/productImport.js'

const CREAMER_ID = '59a9ff7b-b791-4a95-ba73-f4668b6b933a'
const STAR_EACH_ID = '0e5926dd-9164-4eb8-9fc0-ae174f0dd5eb'
const STAR_CASE_ID = 'a7d02241-0d99-4d27-b50c-e62533fbf7dc'

const catalog = [
  { id: CREAMER_ID, product_code: '01SB10', product_name: 'Creamer đặc có đường NSPN XANH biển 1284G.', unit: 'Thùng', status: 'ACTIVE' },
  { id: STAR_EACH_ID, product_code: '07SR11', product_name: 'SCA có đường STAR 100G', unit: 'Cái', status: 'ACTIVE' },
  { id: STAR_CASE_ID, product_code: '07SR11', product_name: 'SCA có đường STAR 100G', unit: 'Thùng', status: 'ACTIVE' },
  { id: 'afc', product_code: null, product_name: 'AFC LUA MI 215.6GRX16', unit: 'Hộp', status: 'ACTIVE' },
  { id: 'g7', product_code: null, product_name: 'G7 3IN1 - hộp 21 gói', unit: 'Hộp', status: 'ACTIVE' },
  { id: 'nuvi', product_code: null, product_name: 'NUVI-Sữa tiệt trùng có đường', unit: 'Thùng', status: 'ACTIVE' },
]

function source(overrides = {}) {
  return {
    product_code: '01SB10',
    item_name: '01SB10-CREAMER ĐẶC CÓ ĐƯỜNG NSPN XANH BIỂN 1284g.',
    unit: 'THUNG',
    quantity: 1,
    unit_price_after_vat: 57200,
    row_type: 'MUA',
    ...overrides,
  }
}

function fakeRepository(initialProducts = catalog, initialHistories = []) {
  const products = structuredClone(initialProducts)
  const histories = structuredClone(initialHistories)
  let nextProduct = 1
  let nextHistory = 1
  return {
    products,
    histories,
    async listProducts() { return structuredClone(products) },
    async insertProduct(product) {
      const inserted = { id: `new-${nextProduct++}`, ...product }
      products.push(inserted)
      return structuredClone(inserted)
    },
    async findInvoiceHistory(productId, invoiceId) {
      return histories.find(row => row.product_id === productId && row.invoice_id === invoiceId) || null
    },
    async insertHistory(history) {
      const inserted = { id: `history-${nextHistory++}`, ...history }
      histories.push(inserted)
      return structuredClone(inserted)
    },
    async deactivateOtherHistory(productId, activeHistoryId) {
      histories.forEach(row => {
        if (row.product_id === productId && row.id !== activeHistoryId) row.is_active_price = false
      })
    },
  }
}

const importArgs = (repository, items, invoiceId = 'invoice-a') => ({
  repository,
  invoiceId,
  importDate: '2026-09-23',
  items,
  groupKey: 'Sữa',
  suggestedPriceFor: () => 66000,
})

test('exact SKU plus compatible unit resolves MATCHED', () => {
  const result = resolveProduct(source(), catalog)
  assert.equal(result.status, PRODUCT_RESOLUTION.MATCHED)
  assert.equal(result.product.id, CREAMER_ID)
  assert.deepEqual(result.evidence, ['EXACT_PRODUCT_CODE', 'COMPATIBLE_UNIT'])
})

test('duplicate SKU is resolved by compatible packaging unit', () => {
  assert.equal(resolveProduct(source({ product_code: '07SR11', item_name: 'SCA có đường STAR 100G', unit: 'Thùng' }), catalog).product.id, STAR_CASE_ID)
  assert.equal(resolveProduct(source({ product_code: '07SR11', item_name: 'SCA có đường STAR 100G', unit: 'Cái' }), catalog).product.id, STAR_EACH_ID)
})

test('exact SKU plus conflicting unit is AMBIGUOUS', () => {
  const result = resolveProduct(source({ product_code: '07SR11', unit: 'Bịch' }), catalog)
  assert.equal(result.status, PRODUCT_RESOLUTION.AMBIGUOUS)
  assert.equal(result.reason, 'SKU_UNIT_CONFLICT')
  assert.equal(result.candidates.length, 2)
})

test('duplicate SKU without unit is AMBIGUOUS', () => {
  const result = resolveProduct(source({ product_code: '07SR11', unit: '' }), catalog)
  assert.equal(result.status, PRODUCT_RESOLUTION.AMBIGUOUS)
  assert.equal(result.reason, 'SKU_REQUIRES_UNIT')
})

test('verified SKU prefix is removed only from the source candidate name', () => {
  const normalized = normalizeSourceProduct(source())
  assert.equal(normalized.sourceDescription, '01SB10-CREAMER ĐẶC CÓ ĐƯỜNG NSPN XANH BIỂN 1284g.')
  assert.equal(normalized.candidateName, 'CREAMER ĐẶC CÓ ĐƯỜNG NSPN XANH BIỂN 1284g.')
})

test('AFC, G7 and NUVI prefixes remain part of names without separate SKU evidence', () => {
  for (const product of catalog.filter(row => ['afc', 'g7', 'nuvi'].includes(row.id))) {
    const normalized = normalizeSourceProduct({ item_name: product.product_name, unit: product.unit })
    assert.equal(normalized.candidateName, product.product_name)
    assert.equal(resolveProduct({ item_name: product.product_name, unit: product.unit }, catalog).product.id, product.id)
  }
})

test('2IN1, 3IN1, unknown abbreviations and legitimate hyphens are preserved', () => {
  for (const value of ['2IN1 Xmen hương gỗ', 'G7 3IN1 - hộp 21 gói', '24d/10x6g/24g KDHITC', 'Sữa-chua có đường']) {
    assert.equal(normalizeSourceProduct({ item_name: value, unit: 'Hộp' }).candidateName, value)
  }
})

test('same canonical name and unit resolves without a SKU', () => {
  const result = resolveProduct({ item_name: '  Creamer đặc có đường NSPN XANH biển 1284G.  ', unit: 'thùng' }, catalog)
  assert.equal(result.status, PRODUCT_RESOLUTION.MATCHED)
  assert.equal(result.product.id, CREAMER_ID)
})

test('casing, whitespace and safe trailing punctuation differences do not create duplicates', () => {
  const result = resolveProduct({ item_name: '  creamer   ĐẶC có đường nspn xanh biển 1284g ', unit: ' THÙNG ' }, catalog)
  assert.equal(result.status, PRODUCT_RESOLUTION.MATCHED)
  assert.equal(result.product.id, CREAMER_ID)
})

test('unit normalization changes spelling/casing only, never packaging level', () => {
  assert.equal(normalizeUnitDisplay(' THUNG '), 'Thùng')
  assert.equal(normalizeUnitDisplay('cái'), 'Cái')
  assert.notEqual(normalizeUnitDisplay('Cái'), normalizeUnitDisplay('Thùng'))
})

test('matched import keeps canonical identity and appends current price history', async () => {
  const repository = fakeRepository()
  const before = structuredClone(repository.products.find(row => row.id === CREAMER_ID))
  const result = await importInvoiceProducts(importArgs(repository, [source()]))
  assert.equal(result.status, 'COMPLETED')
  assert.equal(repository.products.length, catalog.length)
  assert.deepEqual(repository.products.find(row => row.id === CREAMER_ID), before)
  assert.equal(repository.histories.length, 1)
  assert.equal(repository.histories[0].product_id, CREAMER_ID)
  assert.equal(repository.histories[0].unit_price_after_vat, 57200)
  assert.equal(repository.histories[0].suggested_retail_price, 66000)
})

test('a new import makes the new price current and preserves the old history row', async () => {
  const repository = fakeRepository(catalog, [{
    id: 'old-history', product_id: CREAMER_ID, invoice_id: 'old-invoice',
    unit_price_after_vat: 55404, suggested_retail_price: 64000, is_active_price: true,
  }])
  await importInvoiceProducts(importArgs(repository, [source()], 'new-invoice'))
  assert.equal(repository.histories.length, 2)
  assert.equal(repository.histories.find(row => row.id === 'old-history').is_active_price, false)
  assert.equal(repository.histories.find(row => row.invoice_id === 'new-invoice').is_active_price, true)
})

test('a complete new identity creates exactly one product', async () => {
  const repository = fakeRepository()
  const newItem = source({ product_code: '99NEW1', item_name: 'Sản phẩm thử nghiệm 250G', unit: 'Gói' })
  await importInvoiceProducts(importArgs(repository, [newItem]))
  assert.equal(repository.products.filter(row => row.product_code === '99NEW1').length, 1)
  assert.equal(repository.histories.length, 1)
})

test('repeated processing is idempotent for product and invoice history', async () => {
  const repository = fakeRepository()
  const args = importArgs(repository, [source()])
  await importInvoiceProducts(args)
  await importInvoiceProducts(args)
  assert.equal(repository.products.length, catalog.length)
  assert.equal(repository.histories.length, 1)
})

test('duplicate new lines in one invoice create one product and one history', async () => {
  const repository = fakeRepository()
  const newItem = source({ product_code: '99NEW2', item_name: 'Sản phẩm mới lặp 500G', unit: 'Gói' })
  await importInvoiceProducts(importArgs(repository, [newItem, { ...newItem }], 'invoice-new'))
  assert.equal(repository.products.filter(row => row.product_code === '99NEW2').length, 1)
  assert.equal(repository.histories.filter(row => row.invoice_id === 'invoice-new').length, 1)
})

test('ambiguous candidate never inserts a product or history', async () => {
  const repository = fakeRepository()
  const result = await importInvoiceProducts(importArgs(repository, [source({ product_code: '07SR11', unit: 'Bịch' })]))
  assert.equal(result.status, PRODUCT_RESOLUTION.AMBIGUOUS)
  assert.equal(repository.products.length, catalog.length)
  assert.equal(repository.histories.length, 0)
})

test('missing product code still resolves safely with exact canonical name and unit', () => {
  const result = resolveProduct({ item_name: 'SCA có đường STAR 100G', unit: 'Thùng' }, catalog)
  assert.equal(result.status, PRODUCT_RESOLUTION.MATCHED)
  assert.equal(result.product.id, STAR_CASE_ID)
})

test('a new item without enough evidence requires confirmation', () => {
  const result = resolveProduct({ item_name: 'Mặt hàng mới kiểu thật 250G', unit: 'Gói' }, catalog)
  assert.equal(result.status, PRODUCT_RESOLUTION.AMBIGUOUS)
  assert.equal(result.reason, 'INSUFFICIENT_NEW_PRODUCT_EVIDENCE')
})
