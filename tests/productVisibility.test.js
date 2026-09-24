import test from 'node:test'
import assert from 'node:assert/strict'

import { mapPriceBook } from '../src/lib/priceBook.js'
import { PRODUCT_STATUS, setProductVisibility } from '../src/lib/productVisibility.js'
import { resolveProduct, PRODUCT_RESOLUTION } from '../src/lib/productResolver.js'

const product = { id: 'hidden-fixture', product_code: 'HIDE01', product_name: 'Sản phẩm giữ lịch sử', unit: 'Hộp', status: 'ACTIVE' }
const history = { id: 'history-fixture', product_id: product.id, unit_price_after_vat: 12000, suggested_retail_price: 15000, is_active_price: true }

test('ACTIVE is visible and INACTIVE is excluded from normal price lookup and matching', () => {
  assert.equal(mapPriceBook([product], [history]).length, 1)
  const inactive = { ...product, status: 'INACTIVE' }
  assert.equal(mapPriceBook([inactive], [history]).length, 0)
  assert.equal(mapPriceBook([inactive], [history], { status: 'INACTIVE' }).length, 1)
  assert.notEqual(resolveProduct({ product_code: 'HIDE01', item_name: product.product_name, unit: product.unit }, [inactive]).status, PRODUCT_RESOLUTION.MATCHED)
})

test('hide and restore only update status and never delete product or history', async () => {
  const products = [structuredClone(product)]
  const histories = [structuredClone(history)]
  const repository = {
    async updateStatus(id, status) {
      const row = products.find(item => item.id === id)
      row.status = status
      return { id, status }
    },
  }

  await setProductVisibility(repository, product.id, PRODUCT_STATUS.INACTIVE)
  assert.equal(products[0].status, 'INACTIVE')
  assert.equal(histories.length, 1)
  await setProductVisibility(repository, product.id, PRODUCT_STATUS.ACTIVE)
  assert.equal(products[0].status, 'ACTIVE')
  assert.equal(histories.length, 1)
})
