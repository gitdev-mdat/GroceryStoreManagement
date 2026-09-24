/**
 * Separates a product code that the extractor already identified from the
 * human-readable name. This intentionally does not guess a code from an
 * arbitrary hyphenated name.
 */
export function separateProductIdentity(productCode, productName) {
  const code = String(productCode ?? '').trim()
  const name = String(productName ?? '').trim()

  if (!code || !name || name.length <= code.length) {
    return { productCode: code, productName: name }
  }

  const leadingText = name.slice(0, code.length)
  const hasSameExplicitCode = leadingText.toLocaleLowerCase('vi-VN') === code.toLocaleLowerCase('vi-VN')
  const hasObservedSeparator = name.charAt(code.length) === '-'

  if (!hasSameExplicitCode || !hasObservedSeparator) {
    return { productCode: code, productName: name }
  }

  const separatedName = name.slice(code.length + 1).trimStart()
  return {
    productCode: code,
    productName: separatedName
      ? separatedName.charAt(0).toLocaleUpperCase('vi-VN') + separatedName.slice(1)
      : name,
  }
}
