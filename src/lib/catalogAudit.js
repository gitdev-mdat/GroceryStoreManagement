import {
  canonicalNameKey,
  normalizeCanonicalName,
  normalizeProductCode,
  normalizeUnitDisplay,
  normalizeUnitKey,
} from './productResolver.js'

export const CATALOG_QUALITY = Object.freeze({
  SAFE_AUTOFIX: 'SAFE_AUTOFIX',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  KEEP_AS_IS: 'KEEP_AS_IS',
})

function groupBy(rows, keyFor) {
  const groups = new Map()
  for (const row of rows) {
    const key = keyFor(row)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return groups
}

export function auditProductCatalog(products = [], histories = []) {
  const skuGroups = groupBy(products, product => normalizeProductCode(product.product_code))
  const duplicateSkus = [...skuGroups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, products: rows }))

  const identityGroups = groupBy(products, product => {
    const name = canonicalNameKey(product.product_name)
    const unit = normalizeUnitKey(product.unit)
    return name && unit ? `${name}\u0000${unit}` : ''
  })
  const duplicateNormalizedIdentities = [...identityGroups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, products: rows }))

  const duplicateSkuIds = new Set(duplicateSkus.flatMap(group => group.products.map(product => product.id)))
  const duplicateIdentityIds = new Set(duplicateNormalizedIdentities.flatMap(group => group.products.map(product => product.id)))
  const historyByProduct = groupBy(histories, history => history.product_id)

  const records = products.map(product => {
    const cleanName = normalizeCanonicalName(product.product_name)
    const cleanUnit = normalizeUnitDisplay(product.unit)
    const reasons = []
    const proposedChanges = {}

    if (!cleanName) reasons.push('MISSING_PRODUCT_NAME')
    if (!cleanUnit) reasons.push('MISSING_UNIT')
    if (duplicateSkuIds.has(product.id)) reasons.push('DUPLICATE_SKU')
    if (duplicateIdentityIds.has(product.id)) reasons.push('DUPLICATE_NORMALIZED_NAME_AND_UNIT')

    const looksLikeDenseSupplierDescription = /(?:\d+[a-z]?\/\d+|\d+x\d+|(?:grx|mlx|gx)\d+)/i.test(cleanName)
    if (looksLikeDenseSupplierDescription) reasons.push('DENSE_SUPPLIER_OR_PACKAGING_DESCRIPTION')

    if (cleanName && cleanName !== String(product.product_name ?? '')) proposedChanges.product_name = cleanName
    if (cleanUnit && cleanUnit !== String(product.unit ?? '')) proposedChanges.unit = cleanUnit

    let classification = CATALOG_QUALITY.KEEP_AS_IS
    if (reasons.length) classification = CATALOG_QUALITY.REVIEW_REQUIRED
    else if (Object.keys(proposedChanges).length) classification = CATALOG_QUALITY.SAFE_AUTOFIX

    return {
      product,
      classification,
      reasons,
      proposedChanges,
      historyUsage: historyByProduct.get(product.id) || [],
    }
  })

  const counts = Object.values(CATALOG_QUALITY).reduce((result, classification) => {
    result[classification] = records.filter(record => record.classification === classification).length
    return result
  }, {})

  return {
    total: products.length,
    counts,
    records,
    duplicateSkus,
    duplicateNormalizedIdentities,
  }
}

export async function runLiveCatalogAudit(client) {
  const [productsResult, historiesResult] = await Promise.all([
    client.from('products').select('id, product_code, product_name, unit, status, group_key, created_at').range(0, 999),
    client.from('price_history').select('id, product_id, invoice_id, import_date, unit_price_after_vat, suggested_retail_price, is_active_price').range(0, 1999),
  ])
  if (productsResult.error) throw productsResult.error
  if (historiesResult.error) throw historiesResult.error
  return auditProductCatalog(productsResult.data || [], historiesResult.data || [])
}

export async function applySafeCatalogFixes(client, audit) {
  const safeRows = audit.records.filter(record => record.classification === CATALOG_QUALITY.SAFE_AUTOFIX)
  const changed = []

  for (const record of safeRows) {
    const { product, proposedChanges } = record
    let query = client.from('products').update(proposedChanges).eq('id', product.id)
    if (Object.hasOwn(proposedChanges, 'product_name')) query = query.eq('product_name', product.product_name)
    if (Object.hasOwn(proposedChanges, 'unit')) query = query.eq('unit', product.unit)
    const result = await query.select('id, product_code, product_name, unit, status')
    if (result.error) throw result.error
    if (result.data?.length !== 1) throw new Error(`SAFE_AUTOFIX_GUARD_FAILED:${product.id}`)
    changed.push({ before: product, after: result.data[0], proposedChanges })
  }

  return changed
}
