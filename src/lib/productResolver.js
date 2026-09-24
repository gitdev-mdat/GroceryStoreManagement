export const PRODUCT_RESOLUTION = Object.freeze({
  MATCHED: 'MATCHED',
  AMBIGUOUS: 'AMBIGUOUS',
  NEW_PRODUCT: 'NEW_PRODUCT',
})

const UNIT_DISPLAY = new Map([
  ['thung', 'Thùng'],
  ['cai', 'Cái'],
  ['hop', 'Hộp'],
  ['bich', 'Bịch'],
  ['day', 'Dây'],
  ['bo', 'Bộ'],
  ['goi', 'Gói'],
  ['chai', 'Chai'],
  ['lon', 'Lon'],
  ['loc', 'Lốc'],
  ['ket', 'Két'],
  ['bao', 'Bao'],
  ['tui', 'Túi'],
  ['vi', 'Vỉ'],
  ['vien', 'Viên'],
])

function foldVietnamese(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
}

export function normalizeProductCode(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleUpperCase('vi-VN')
}

export function normalizeUnitKey(value) {
  return foldVietnamese(value).trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ')
}

export function normalizeUnitDisplay(value) {
  const source = String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!source) return ''
  return UNIT_DISPLAY.get(normalizeUnitKey(source)) || source
}

export function normalizeCanonicalName(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ')
}

export function canonicalNameKey(value) {
  return foldVietnamese(normalizeCanonicalName(value))
    .toLocaleLowerCase('vi-VN')
    .replace(/[.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
}

export function normalizeSourceProduct(item = {}) {
  const productCode = normalizeProductCode(item.product_code ?? item.ma_hang_goc)
  const sourceDescription = normalizeCanonicalName(
    item.source_description ?? item.item_name ?? item.ten_hang ?? item.product_name
  )
  const unit = normalizeUnitDisplay(item.unit ?? item.don_vi_tinh)

  let candidateName = sourceDescription
  if (productCode && sourceDescription.length > productCode.length) {
    const leading = sourceDescription.slice(0, productCode.length)
    const separator = sourceDescription.charAt(productCode.length)
    if (normalizeProductCode(leading) === productCode && separator === '-') {
      candidateName = normalizeCanonicalName(sourceDescription.slice(productCode.length + 1))
      if (candidateName) {
        candidateName = candidateName.charAt(0).toLocaleUpperCase('vi-VN') + candidateName.slice(1)
      }
    }
  }

  return { productCode, sourceDescription, candidateName, unit }
}

function candidateView(product) {
  return {
    id: product.id,
    product_code: product.product_code ?? '',
    product_name: product.product_name ?? '',
    unit: product.unit ?? '',
  }
}

function matched(product, evidence) {
  return {
    status: PRODUCT_RESOLUTION.MATCHED,
    product: candidateView(product),
    candidates: [candidateView(product)],
    evidence,
    confidence: 'HIGH',
  }
}

function ambiguous(reason, candidates = [], evidence = []) {
  return {
    status: PRODUCT_RESOLUTION.AMBIGUOUS,
    reason,
    candidates: candidates.map(candidateView),
    evidence,
    confidence: 'LOW',
  }
}

export function resolveProduct(sourceItem, products = []) {
  const source = normalizeSourceProduct(sourceItem)
  const activeProducts = products.filter(product => product?.id && product.status !== 'INACTIVE')

  if (sourceItem?._resolved_product_id) {
    const selected = activeProducts.find(product => product.id === sourceItem._resolved_product_id)
    return selected
      ? matched(selected, ['USER_CONFIRMED_PRODUCT'])
      : ambiguous('SELECTED_PRODUCT_NOT_AVAILABLE')
  }

  if (source.productCode) {
    const codeMatches = activeProducts.filter(
      product => normalizeProductCode(product.product_code) === source.productCode
    )

    if (codeMatches.length) {
      if (!source.unit && codeMatches.length > 1) {
        return ambiguous('SKU_REQUIRES_UNIT', codeMatches, ['EXACT_PRODUCT_CODE'])
      }

      const unitMatches = source.unit
        ? codeMatches.filter(product => normalizeUnitKey(product.unit) === normalizeUnitKey(source.unit))
        : codeMatches

      if (unitMatches.length === 1) {
        return matched(unitMatches[0], source.unit
          ? ['EXACT_PRODUCT_CODE', 'COMPATIBLE_UNIT']
          : ['EXACT_UNIQUE_PRODUCT_CODE'])
      }

      if (unitMatches.length > 1) {
        const nameMatches = unitMatches.filter(
          product => canonicalNameKey(product.product_name) === canonicalNameKey(source.candidateName)
        )
        if (nameMatches.length === 1) {
          return matched(nameMatches[0], ['EXACT_PRODUCT_CODE', 'COMPATIBLE_UNIT', 'EXACT_CANONICAL_NAME'])
        }
        return ambiguous('DUPLICATE_SKU_AND_UNIT', unitMatches, ['EXACT_PRODUCT_CODE', 'COMPATIBLE_UNIT'])
      }

      return ambiguous('SKU_UNIT_CONFLICT', codeMatches, ['EXACT_PRODUCT_CODE', 'CONFLICTING_UNIT'])
    }
  }

  const nameKey = canonicalNameKey(source.candidateName)
  const unitKey = normalizeUnitKey(source.unit)
  if (nameKey && unitKey) {
    const nameUnitMatches = activeProducts.filter(product =>
      canonicalNameKey(product.product_name) === nameKey && normalizeUnitKey(product.unit) === unitKey
    )
    if (nameUnitMatches.length === 1) {
      return matched(nameUnitMatches[0], ['EXACT_CANONICAL_NAME', 'COMPATIBLE_UNIT'])
    }
    if (nameUnitMatches.length > 1) {
      return ambiguous('DUPLICATE_NAME_AND_UNIT', nameUnitMatches, ['EXACT_CANONICAL_NAME', 'COMPATIBLE_UNIT'])
    }
  }

  const hasReliableNewIdentity = Boolean(source.productCode && nameKey && unitKey)
  if (hasReliableNewIdentity || sourceItem?._confirm_new_product === true) {
    return {
      status: PRODUCT_RESOLUTION.NEW_PRODUCT,
      product: null,
      candidates: [],
      evidence: hasReliableNewIdentity
        ? ['NEW_EXPLICIT_PRODUCT_CODE', 'VALID_NAME', 'VALID_UNIT']
        : ['USER_CONFIRMED_NEW_PRODUCT', 'VALID_NAME', 'VALID_UNIT'],
      confidence: hasReliableNewIdentity ? 'HIGH' : 'USER_CONFIRMED',
      proposedProduct: {
        product_code: source.productCode || null,
        product_name: source.candidateName,
        unit: source.unit,
      },
    }
  }

  return ambiguous('INSUFFICIENT_NEW_PRODUCT_EVIDENCE', [], [
    source.productCode ? 'EXPLICIT_PRODUCT_CODE' : 'MISSING_PRODUCT_CODE',
    nameKey ? 'VALID_NAME' : 'MISSING_NAME',
    unitKey ? 'VALID_UNIT' : 'MISSING_UNIT',
  ])
}

export function preflightProductItems(items = [], products = []) {
  return items.map((item, index) => ({
    index,
    item,
    source: normalizeSourceProduct(item),
    resolution: resolveProduct(item, products),
  }))
}
