import test from 'node:test'
import assert from 'node:assert/strict'

import { auditProductCatalog, CATALOG_QUALITY } from '../src/lib/catalogAudit.js'

test('catalog audit separates safe formatting from identity review', () => {
  const products = [
    { id: 'safe', product_code: 'A1', product_name: '  Tên   sạch  ', unit: 'THUNG' },
    { id: 'dup-a', product_code: '07SR11', product_name: 'SCA có đường STAR 100G', unit: 'Cái' },
    { id: 'dup-b', product_code: '07sr11', product_name: 'SCA có đường STAR 100G', unit: 'Thùng' },
    { id: 'dense', product_code: null, product_name: 'AFC LUA MI 215.6GRX16', unit: 'Hộp' },
    { id: 'keep', product_code: null, product_name: 'G7 3IN1 - hộp 21 gói', unit: 'Hộp' },
  ]
  const result = auditProductCatalog(products, [{ product_id: 'dup-a', invoice_id: 'invoice-a' }])

  assert.equal(result.total, 5)
  assert.equal(result.records.find(row => row.product.id === 'safe').classification, CATALOG_QUALITY.SAFE_AUTOFIX)
  assert.deepEqual(result.records.find(row => row.product.id === 'safe').proposedChanges, { product_name: 'Tên sạch', unit: 'Thùng' })
  assert.equal(result.records.find(row => row.product.id === 'dup-a').classification, CATALOG_QUALITY.REVIEW_REQUIRED)
  assert.equal(result.records.find(row => row.product.id === 'dup-a').historyUsage.length, 1)
  assert.equal(result.records.find(row => row.product.id === 'dense').classification, CATALOG_QUALITY.REVIEW_REQUIRED)
  assert.equal(result.records.find(row => row.product.id === 'keep').classification, CATALOG_QUALITY.KEEP_AS_IS)
  assert.equal(result.duplicateSkus.length, 1)
})
