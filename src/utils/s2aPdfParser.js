/**
 * s2aPdfParser.js
 *
 * Parses extracted PDF text from BCT_Thang1.pdf (S2A-HKD revenue book)
 * into structured S2A revenue rows using positional text item data.
 *
 * Architecture: columnar multi-record extraction.
 * A single PDF page/y-bucket can contain N logical business records.
 * The nth item in each table column belongs to the nth record.
 *
 * Follows: docs/PDF_FORMAT_SPECIFICATION.md
 * Input:   result from extractPdfText() — { pages, fullText, ... }
 * Output:  ParsedResult
 */

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

/**
 * NFKC + lowercase + whitespace collapse for group / pattern matching only.
 * Preserves Vietnamese diacritics.
 */
function normalizeForMatch(value) {
  return (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const GROUP_PATTERNS = [
  { code: 'hmpt', regex: /hóa\s+mỹ\s+phẩm\s*&\s*tẩy\s+rửa/i },
  { code: 'ddgd', regex: /đồ\s+dùng\s+gia\s+đình\s*&\s*tiện\s+ích/i },
  { code: 'tpdg', regex: /thực\s+phẩm\s+đóng\s+gói\s*&\s*đồ\s+uống/i },
  { code: 'tpts', regex: /hàng\s+hóa\s+tươi\s+sống/i },
]

const GROUP_NAMES = {
  hmpt: 'Hóa mỹ phẩm & Tẩy rửa',
  ddgd: 'Đồ dùng gia đình & Tiện ích',
  tpdg: 'Thực phẩm đóng gói & Đồ uống',
  tpts: 'Hàng hóa tươi sống',
}

const EXCLUDED_PATTERNS = [
  // Table header rows
  /^\s*STT\s*[\s|/]/i,
  /STT.*Ngày.*tháng.*Số.*hiệu/i,
  // Group headings
  /^Nhóm\s+Hóa\s+mỹ\s+phẩm\s*&\s*Tẩy\s+rửa$/i,
  /^Nhóm\s+Đồ\s+dùng\s+gia\s+đình\s*&\s*Tiện\s+ích$/i,
  /^Nhóm\s+Thực\s+phẩm\s+đóng\s+gói\s*&\s*Đồ\s+uống$/i,
  /^Nhóm\s+hàng\s+hóa\s+tươi\s+sống$/i,
  // Group subtotals
  /Tổng\s+cộng\s*\(\s*\d+\s*\)/i,
  // Grand total
  /^Tổng\s+cộng\s*$/i,
  /^Tổng\s+cộng\s+-\s*$/i,
  // Tax rows
  /Thuế\s+GTGT/i,
  /Thuế\s+TNCN/i,
  /Tổng\s+số\s+thuế\s+GTGT/i,
  /Tổng\s+số\s+thuế\s+TNCN/i,
  /Thuế\s+giá\s+trị\s+gia\s+tăng/i,
  /Thuế\s+thu\s+nhập\s+cá\s+nhân/i,
  // Signatures
  /Người\s+đại\s+diện/i,
  /Ký,\s*họ\s*tên/i,
  /Điểm\s+bán\s+hàng/i,
  /Chữ\s+ký/i,
  // Dotted signature placeholders
  /\(Ký,\s*ghi\s*rõ\s*họ\s*tên\s*và\s*đóng\s*dấu/i,
  /Ngày\s+\.+\s*tháng\s+\.+\s*năm\s+\.+/i,
  // Page headers / footers
  /Trang\s+\d+\s*\/\s*\d+/i,
  /Cục\s+Thuế/i,
  /Chi\s+cục\s+Thuế/i,
  /Thông\s+tư\s+152/i,
  /Thông\s+tư\s+152[\/\-]/i,
  // Report headers
  /^SỔ\s+DOANH\s+THU/i,
  /^Mẫu\s+số\s+S2a/i,
  /Tháng\s+\d+\s+năm\s+\d{4}/i,
  /Tên\s+đơn\s+vị/i,
  /Địa\s+chỉ\s*:/i,
  /Mã\s+số\s+thuế\s*:/i,
  // Blank / whitespace only
  /^\s*$/,
]

const DATE_REGEX = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/
const VOUCHER_REGEX = /^\s*(\d+)\s*\/\s*BL\s*$/i
const TAX_RATE_REGEX = /^\s*(\d+(?:[.,]\d+)?)\s*%\s*$/

/**
 * VND amount format: one to three digits, then one or more groups
 * of exactly three digits preceded by a dot.
 * Examples: 529.000  |  1.160.000  |  17.229.000  |  695  |  1
 */
const AMOUNT_REGEX = /^\d{1,3}(\.\d{3})+(\s*)$/

/**
 * Strict VND amount: exactly the same as AMOUNT_REGEX, used for parseAmount.
 */
const AMOUNT_PLAIN_REGEX = /^\d{1,3}(\.\d{3})+$/

/**
 * Column x-coordinate boundaries — MUTUALLY EXCLUSIVE.
 * Each item can match at most one column.
 *
 * Observed from actual PDF extraction:
 *   STT:          x ≈ 43.72  →  x < 60
 *   Sale date:    x ≈ 71.81  →  60 ≤ x < 130
 *   Voucher:      x ≈ 159.64 →  130 ≤ x < 210
 *   Document date:x ≈ 240.80 →  210 ≤ x < 310
 *   Description:  x ≈ 340.57 →  310 ≤ x < 610
 *   Tax rate:     x ≈ 627.45 →  610 ≤ x < 670
 *   Amount:       x ≈ 719.29 →  x ≥ 670
 */
const COLUMN_X_BOUNDS = [
  { col: 'STT',            lo:   0, hi:  60 },  // x < 60
  { col: 'SALE_DATE',    lo:  60, hi: 130 },  // 60 ≤ x < 130
  { col: 'VOUCHER',     lo: 130, hi: 210 },  // 130 ≤ x < 210
  { col: 'DOCUMENT_DATE', lo: 210, hi: 310 }, // 210 ≤ x < 310
  { col: 'DESCRIPTION',  lo: 310, hi: 610 },  // 310 ≤ x < 610
  { col: 'TAX_RATE',    lo: 610, hi: 670 },  // 610 ≤ x < 670
  { col: 'AMOUNT',      lo: 670, hi: Infinity }, // x ≥ 670
]

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function isExcluded(text) {
  if (!text || !text.trim()) return true
  for (const p of EXCLUDED_PATTERNS) {
    if (p.test(text)) return true
  }
  return false
}

/**
 * Classify a single text item into a table column by its x position.
 * Returns one of: 'STT' | 'SALE_DATE' | 'VOUCHER' | 'DOCUMENT_DATE'
 *                | 'DESCRIPTION' | 'TAX_RATE' | 'AMOUNT' | null
 *
 * Boundaries are non-overlapping and checked in fixed order.
 * null = this item does not fall within any table column.
 * Zero-height items (PDF.js spacing artefacts) are ignored.
 */
function classifyItemByColumn(item) {
  if (item.height !== undefined && item.height !== null && item.height < 1) {
    return null
  }
  const x = item.x
  for (const { col, lo, hi } of COLUMN_X_BOUNDS) {
    if (x >= lo && x < hi) return col
  }
  return null
}

/**
 * Parse a date string into { display, iso } or null if invalid.
 */
function parseDate(str) {
  const m = DATE_REGEX.exec((str || '').trim())
  if (!m) return null
  const day   = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const year  = parseInt(m[3], 10)
  if (month < 1 || month > 12) return null
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) return null
  return {
    display: `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`,
    iso: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
  }
}

/**
 * Parse a VND amount string into an integer.
 * Examples: "529.000" → 529000, "1.160.000" → 1160000
 */
function parseAmount(str) {
  const m = AMOUNT_REGEX.exec((str || '').trim())
  if (!m) return null
  const cleaned = m[0].trim().replace(/\./g, '')
  if (!/^\d+$/.test(cleaned)) return null
  return parseInt(cleaned, 10)
}

/**
 * Detect a standalone group-heading bucket (top of page, no revenue data).
 *
 * Revenue rows contain "Bán lẻ", voucher numbers, dates, and amounts.
 * This function returns null for any such row so it is NOT excluded.
 *
 * Only returns a group code for true standalone headings — no
 * "Bán lẻ", no voucher /BL, no date.
 */
function detectStandaloneGroupHeading(text) {
  const normalized = normalizeForMatch(text)
  // A revenue row always has "Bán lẻ" in its description
  if (normalized.includes('bán lẻ')) return null
  // Revenue rows also contain /BL tokens
  if (/\/bl\b/i.test(text)) return null
  // Standalone headings have no date fields
  if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) return null
  for (const { code, regex } of GROUP_PATTERNS) {
    if (regex.test(normalized)) return code
  }
  return null
}

/**
 * Detect group code from description text (primary group derivation).
 * For revenue records only — uses substring matching on the description field.
 */
function detectGroupFromDescription(desc) {
  const norm = normalizeForMatch(desc)
  for (const { code, regex } of GROUP_PATTERNS) {
    if (regex.test(norm)) return code
  }
  return null
}

// ─────────────────────────────────────────
// Per-page bucket extraction
// ─────────────────────────────────────────

/**
 * Build per-page y-bucketed item lists.
 * Each page is processed independently — items from different pages are
 * never mixed even if they share the same y coordinate.
 * Within each bucket, items are sorted by x ascending (left to right).
 */
export function extractBuckets(pages) {
  const result = []
  for (const page of pages) {
    const { textItems, pageNumber } = page
    if (!textItems || textItems.length === 0) continue

    const yBuckets = new Map()
    for (const item of textItems) {
      const yKey = Math.round(item.y)
      if (!yBuckets.has(yKey)) yBuckets.set(yKey, [])
      yBuckets.get(yKey).push(item)
    }

    // y descending: group headings (top of page, large y) come before
    // revenue rows (bottom of page, small y) so activeGroup is set first
    const sortedYs = [...yBuckets.keys()].sort((a, b) => b - a)

    const buckets = []
    for (const y of sortedYs) {
      const items = yBuckets.get(y).sort((a, b) => a.x - b.x)
      buckets.push({ y, items })
    }

    result.push({ pageNumber, buckets })
  }
  return result
}

// ─────────────────────────────────────────
// Columnar record extraction
// ─────────────────────────────────────────

/**
 * Given a bucket (y-level), classify all items into columns and zip
 * them into logical records using occurrence-index pairing.
 *
 * Returns { records, columnCounts, isRevenueBucket }
 *
 * isRevenueBucket = bucket contains at least one /BL voucher item,
 * one "Bán lẻ" description item, and one amount-column item.
 *
 * If isRevenueBucket is false, returns empty records (caller treats as excluded).
 * If isRevenueBucket is true but some record indices lack required fields,
 * those incomplete indices are returned as rejected candidates.
 */
function extractRecordsFromBucket(bucket, activeGroup) {
  const { y, items } = bucket

  // Quick bucket-level exclusion (headers, signatures, etc.)
  const rawText = items.map(it => it.text).join(' ')
  if (isExcluded(rawText)) return { records: [], isRevenueBucket: false, columnCounts: null }

  // Group heading buckets are excluded at the caller level (parseS2aPdf).
  // NOTE: do NOT call detectGroup(rawText) here — revenue row descriptions
  // contain "Nhóm …" text which would match and incorrectly exclude them.

  // Classify each item into non-overlapping columns
  const columns = {
    STT:           [],
    SALE_DATE:     [],
    VOUCHER:       [],
    DOCUMENT_DATE:  [],
    DESCRIPTION:   [],
    TAX_RATE:      [],
    AMOUNT:        [],
  }

  for (const item of items) {
    const col = classifyItemByColumn(item)
    if (col && col in columns) {
      columns[col].push(item)
    }
  }

  // ── Revenue bucket gate ─────────────────────────────────────
  // A bucket is a revenue bucket only if it contains:
  //   - ≥1 voucher-column item (contains /BL)
  //   - ≥1 description-column item containing "Bán lẻ"
  //   - ≥1 amount-column item (x-validated)
  const hasVoucher   = columns.VOUCHER.length > 0
  const hasBanLe      = columns.DESCRIPTION.some(it => it.text.includes('Bán lẻ'))
  const hasAmount     = columns.AMOUNT.length > 0
  const isRevenueBucket = hasVoucher && hasBanLe && hasAmount

  if (!isRevenueBucket) {
    return { records: [], isRevenueBucket: false, columnCounts: null }
  }

  // ── Column counts for diagnostic ─────────────────────────────
  const columnCounts = {
    STT:           columns.STT.length,
    SALE_DATE:     columns.SALE_DATE.length,
    VOUCHER:       columns.VOUCHER.length,
    DOCUMENT_DATE: columns.DOCUMENT_DATE.length,
    DESCRIPTION:   columns.DESCRIPTION.length,
    TAX_RATE:      columns.TAX_RATE.length,
    AMOUNT:        columns.AMOUNT.length,
  }

  // ── Cardinality — candidate count from core financial columns ─
  // STT is skipped (it is decorative, not financial)
  const candidateCount = Math.max(
    columns.SALE_DATE.length,
    columns.VOUCHER.length,
    columns.DOCUMENT_DATE.length,
    columns.DESCRIPTION.length,
    columns.TAX_RATE.length,
    columns.AMOUNT.length,
  )

  const records = []
  for (let i = 0; i < candidateCount; i++) {
    const saleDate     = columns.SALE_DATE[i]
    const voucher      = columns.VOUCHER[i]
    const docDate      = columns.DOCUMENT_DATE[i]
    const description  = columns.DESCRIPTION[i]
    const taxRate     = columns.TAX_RATE[i]
    const amount      = columns.AMOUNT[i]

    records.push({
      index:           i,
      stt:            columns.STT[i] || null,
      saleDateItem:   saleDate || null,
      voucherItem:    voucher || null,
      documentDateItem: docDate || null,
      descriptionItem: description || null,
      taxRateItem:    taxRate || null,
      amountItem:     amount || null,
      activeGroup,
      bucketY: y,
      columnCounts,
      rawText,
    })
  }

  return { records, isRevenueBucket, columnCounts }
}

// ─────────────────────────────────────────
// Validation
// ─────────────────────────────────────────

/**
 * Validate a single raw record and extract structured fields.
 * Returns a validated ParsedRow or a rejection reason object.
 *
 * Rejection is a plain object (not null) so callers can distinguish
 * structural rejections (missing fields) from parser errors.
 */
function validateRecord(raw) {
  const {
    saleDateItem, voucherItem, documentDateItem,
    descriptionItem, taxRateItem, amountItem,
    pageNumber, activeGroup, index, columnCounts, rawText,
  } = raw

  const saleDateStr  = saleDateItem?.text?.trim()  || ''
  const voucherStr   = voucherItem?.text?.trim()   || ''
  const docDateStr   = documentDateItem?.text?.trim() || ''
  const descStr      = descriptionItem?.text?.trim() || ''
  const taxRateStr   = taxRateItem?.text?.trim()  || ''
  const amountStr    = amountItem?.text?.trim()   || ''

  // Track missing required fields for diagnostic
  const missingFields = []

  // ── Sale date ───────────────────────────────────────────────
  if (!saleDateStr)   missingFields.push('saleDate')
  else if (!DATE_REGEX.test(saleDateStr)) missingFields.push('saleDate (invalid format)')

  // ── Voucher ───────────────────────────────────────────────
  if (!voucherStr)   missingFields.push('voucher')
  else if (!VOUCHER_REGEX.test(voucherStr)) missingFields.push('voucher (invalid format)')

  // ── Amount (x-validated column — must be in AMOUNT column) ──
  if (!amountStr)   missingFields.push('amount')
  else {
    const amt = parseAmount(amountStr)
    if (amt === null) missingFields.push('amount (invalid VND format)')
  }

  // If any core financial field is missing, mark as COLUMN_COUNT_MISMATCH
  if (missingFields.length > 0) {
    return {
      _rejected: true,
      reason: 'COLUMN_COUNT_MISMATCH',
      missingFields,
      columnCounts,
      pageNumber,
      bucketY: raw.bucketY,
      candidateIndex: index,
      rawText,
    }
  }

  // All core fields present — parse
  const parsedDate = parseDate(saleDateStr)
  if (!parsedDate) {
    return {
      _rejected: true,
      reason: 'COLUMN_COUNT_MISMATCH',
      missingFields: ['saleDate (parsed invalid)'],
      columnCounts,
      pageNumber,
      bucketY: raw.bucketY,
      candidateIndex: index,
      rawText,
    }
  }

  // ── Tax rate (optional — null is acceptable) ───────────────
  let taxRate = null
  if (taxRateItem) {
    const taxMatch = TAX_RATE_REGEX.exec(taxRateStr)
    if (!taxMatch) {
      return {
        _rejected: true,
        reason: 'COLUMN_COUNT_MISMATCH',
        missingFields: ['taxRate (invalid format)'],
        columnCounts,
        pageNumber,
        bucketY: raw.bucketY,
        candidateIndex: index,
        rawText,
      }
    }
    taxRate = taxMatch[1]
  }

  // ── Amount ─────────────────────────────────────────────────
  const amount = parseAmount(amountStr)

  // ── Group derivation: description first, then activeGroup ─
  let groupCode = detectGroupFromDescription(descStr)
  if (!groupCode) groupCode = activeGroup

  // ── Description ────────────────────────────────────────────
  const description = descStr || 'Bán lẻ'
  if (!description.includes('Bán lẻ')) {
    return {
      _rejected: true,
      reason: 'COLUMN_COUNT_MISMATCH',
      missingFields: ['description (missing "Bán lẻ")'],
      columnCounts,
      pageNumber,
      bucketY: raw.bucketY,
      candidateIndex: index,
      rawText,
    }
  }

  // ── Voucher number ────────────────────────────────────────
  const voucherMatch = VOUCHER_REGEX.exec(voucherStr)
  const voucherNumber = voucherMatch ? voucherMatch[0].trim() : voucherStr.trim()

  // ── Document date ─────────────────────────────────────────
  let docDateDisplay = parsedDate.display
  if (documentDateItem && docDateStr) {
    const parsedDocDate = parseDate(docDateStr)
    if (parsedDocDate) docDateDisplay = parsedDocDate.display
  }

  // ── needsReview ──────────────────────────────────────────
  const needsReview = amount === 0

  return {
    _rejected: false,
    pageNumber,
    visualRowIndex: -1,
    rawText,
    stt: columnCounts?.STT ? (raw.stt?.text?.trim() || null) : null,
    saleDateDisplay: parsedDate.display,
    saleDateIso: parsedDate.iso,
    voucherNumber,
    documentDateDisplay: docDateDisplay,
    description,
    taxRate: taxRate || '1',
    amount,
    groupCode: groupCode || 'unknown',
    groupName: GROUP_NAMES[groupCode] || groupCode || 'Không xác định',
    status: needsReview ? 'needsReview' : 'valid',
    reason: needsReview ? 'Số tiền bằng 0 — cần xác nhận' : null,
  }
}

// ─────────────────────────────────────────
// Main parse function
// ─────────────────────────────────────────

export function parseS2aPdf(extractionResult) {
  const { fileId, fileName, fileSize, pages } = extractionResult

  const pageBuckets = extractBuckets(pages)

  // ── DEV CHECKPOINT 1: bucket extraction ──────────────────
  if (import.meta.env.DEV) {
    console.log('[DEV] checkpoint: buckets', {
      pages: pageBuckets.length,
      totalBuckets: pageBuckets.reduce((s, p) => s + p.buckets.length, 0),
    })
  }

  const rows = []
  let excludedCount = 0
  let validCount = 0
  let needsReviewCount = 0
  let unknownGroupCount = 0
  let nonRevenueBuckets = 0
  let revenueBuckets = 0
  const rejectedRecords = []
  const bucketStats = []

  let activeGroup = null

  // Track exclusion reasons for development diagnostics
  const exclusionReasons = { GROUP_HEADING: 0, EXCLUDED_PATTERNS: 0, NON_REVENUE_BUCKET: 0, TOTAL: 0 }

  for (const { pageNumber, buckets } of pageBuckets) {
    for (const bucket of buckets) {
      const rawText = bucket.items.map(it => it.text).join(' ')

      // Standalone group heading bucket — update activeGroup and skip
      const headingCode = detectStandaloneGroupHeading(rawText)
      if (headingCode) {
        activeGroup = headingCode
        excludedCount++
        exclusionReasons.GROUP_HEADING++
        continue
      }

      // Generic exclusion patterns (headers, signatures, totals, etc.)
      if (isExcluded(rawText)) {
        excludedCount++
        exclusionReasons.EXCLUDED_PATTERNS++
        continue
      }

      // Columnar extraction with revenue gate
      const { records, isRevenueBucket, columnCounts } = extractRecordsFromBucket(bucket, activeGroup)

      // ── DEV CHECKPOINT 2: per-bucket classification ─────────
      if (import.meta.env.DEV && import.meta.env.DEBUG_PARSER) {
        console.log('[DEV] bucket', {
          pageNumber, y: bucket.y,
          isRevenueBucket,
          columnCounts,
          recordCount: records.length,
          rawText: rawText.slice(0, 120),
        })
      }

      if (!isRevenueBucket) {
        nonRevenueBuckets++
        excludedCount++
        exclusionReasons.NON_REVENUE_BUCKET++
        continue
      }

      revenueBuckets++
      bucketStats.push({ pageNumber, y: bucket.y, recordCount: records.length, columnCounts })

      for (const raw of records) {
        raw.pageNumber = pageNumber
        const result = validateRecord(raw)

        if (result._rejected) {
          rejectedRecords.push(result)
          continue
        }

        result.visualRowIndex = rows.length
        if (result.groupCode === 'unknown') unknownGroupCount++
        rows.push(result)
        if (result.status === 'needsReview') needsReviewCount++; else validCount++
      }
    }
  }

  // ── DEV CHECKPOINT 3: validation summary ───────────────────
  if (import.meta.env.DEV) {
    console.log('[DEV] checkpoint: validation', {
      totalBuckets: pageBuckets.reduce((s, p) => s + p.buckets.length, 0),
      revenueBuckets,
      nonRevenueBuckets,
      excludedCount,
      exclusionReasons,
      candidates: bucketStats.reduce((s, b) => s + b.recordCount, 0),
      rejected: rejectedRecords.length,
      valid: validCount,
      needsReview: needsReviewCount,
      unknownGroups: unknownGroupCount,
      firstRejected: rejectedRecords[0] || null,
    })
  }

  const diagnostics = {
    totalBuckets: bucketStats.length,
    revenueBuckets,
    nonRevenueBuckets,
    excludedCount,
    validCount,
    needsReviewCount,
    unknownGroupCount,
    rejectedRecords: rejectedRecords.length,
  }

  const hasErrors = validCount === 0 && needsReviewCount === 0
  const status = hasErrors ? 'error' : needsReviewCount > 0 ? 'partial' : 'success'

  // ── DEV CHECKPOINT 4: final return ────────────────────────
  if (import.meta.env.DEV) {
    console.log('[DEV] checkpoint: parser-output-full', {
      status,
      errorMessage: hasErrors ? 'Không tìm thấy dòng doanh thu hợp lệ nào trong file.' : null,
      diagnostics,
      rowCount: rows.length,
      validCount: rows.filter(r => r.status === 'valid').length,
      needsReviewCount: rows.filter(r => r.status === 'needsReview').length,
      firstRow: rows[0] || null,
    })
  }

  return {
    fileId,
    fileName,
    fileSize,
    status,
    errorMessage: hasErrors ? 'Không tìm thấy dòng doanh thu hợp lệ nào trong file.' : null,
    rows,
    diagnostics,
    bucketStats,
    rejectedRecords,
  }
}

export function parseS2aPdfAll(extractionResults) {
  return extractionResults.map(result => parseS2aPdf(result))
}
