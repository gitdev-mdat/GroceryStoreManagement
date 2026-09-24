/**
 * s2aDailyAggregator.js
 *
 * Aggregates parsed S2A revenue rows into daily preview rows for S1A.
 *
 * Follows: docs/PDF_FORMAT_SPECIFICATION.md Section 7
 *
 * Input:  Array of ParsedFileResult from s2aPdfParser
 * Output: AggregationResult
 */

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const GROUP_META = {
  hmpt: { code: 'hmpt', name: 'Hóa mỹ phẩm & Tẩy rửa' },
  ddgd: { code: 'ddgd', name: 'Đồ dùng gia đình & Tiện ích' },
  tpdg: { code: 'tpdg', name: 'Thực phẩm đóng gói & Đồ uống' },
  tpts: { code: 'tpts', name: 'Hàng hóa tươi sống' },
}

// ─────────────────────────────────────────
// Daily aggregator
// ─────────────────────────────────────────

/**
 * Aggregate valid + needsReview S2A rows into S1A daily rows.
 *
 * @param {ParsedFileResult[]} parsedResults
 * @returns {AggregationResult}
 *
 * @typedef {Object} AggregationResult
 * @property {AggregatedDay[]} days
 * @property {ReconciliationResult} reconciliation
 * @property {number} totalSourceRows
 * @property {number} validRows
 * @property {number} needsReviewRows
 * @property {number} excludedRows
 * @property {number} uniqueDates
 * @property {'success'|'error'} status
 * @property {string|null} errorMessage
 */
export function aggregateDaily(parsedResults) {
  // ── Flatten all valid + needsReview rows from all files ─────────
  let totalSourceRows = 0
  let validRows = 0
  let needsReviewRows = 0
  let excludedRows = 0

  const allRows = []
  for (const file of parsedResults) {
    excludedRows += file.diagnostics.excludedCount
    for (const row of file.rows) {
      totalSourceRows++
      if (row.status === 'valid') {
        allRows.push(row)
        validRows++
      } else if (row.status === 'needsReview') {
        allRows.push(row)
        needsReviewRows++
      }
      // excluded status rows are not added
    }
  }

  const uniqueDates = new Set(allRows.map(r => r.saleDateIso)).size

  // ── Group by date ────────────────────────────────────────────
  const byDate = new Map()
  for (const row of allRows) {
    const iso = row.saleDateIso
    if (!byDate.has(iso)) {
      byDate.set(iso, {
        isoDate: iso,
        displayDate: row.saleDateDisplay,
        rows: [],
        groupTotals: { hmpt: 0, ddgd: 0, tpdg: 0, tpts: 0 },
        groupRows: { hmpt: 0, ddgd: 0, tpdg: 0, tpts: 0 },
      })
    }
    const dayBucket = byDate.get(iso)
    dayBucket.rows.push(row)
    if (row.groupCode && dayBucket.groupTotals[row.groupCode] !== undefined) {
      dayBucket.groupTotals[row.groupCode] += row.amount
      dayBucket.groupRows[row.groupCode]++
    }
  }

  // ── Build AggregatedDay list ────────────────────────────────
  const days = []
  const sortedDates = [...byDate.keys()].sort()

  for (const isoDate of sortedDates) {
    const bucket = byDate.get(isoDate)
    const { isoDate: _, rows, groupTotals, groupRows } = bucket

    // Build group breakdown (only non-zero groups)
    const groupBreakdown = Object.entries(groupTotals)
      .filter(([_, amount]) => amount > 0)
      .map(([code, amount]) => ({
        groupCode: code,
        groupName: GROUP_META[code]?.name || code,
        amount,
        sourceRowCount: groupRows[code],
      }))

    const totalAmount = Object.values(groupTotals).reduce((s, v) => s + v, 0)
    const sourceRowCount = rows.length

    // Determine if any needsReview rows affect this day
    const hasNeedsReview = rows.some(r => r.status === 'needsReview')

    // notes template
    const notes = `Doanh thu bán lẻ tạp hóa ngày ${bucket.displayDate} theo bảng kê ngày ${bucket.displayDate}`

    days.push({
      saleDate: isoDate,
      displayDate: bucket.displayDate,
      totalAmount,
      sourceRowCount,
      groupBreakdown,
      notes,
      status: hasNeedsReview ? 'needsReview' : 'ready',
      warnings: hasNeedsReview
        ? [`${rows.filter(r => r.status === 'needsReview').length} dòng cần xác nhận`]
        : [],
      _rows: rows, // internal, not shown in preview
    })
  }

  // ── Reconciliation ──────────────────────────────────────────
  const grandTotalBefore = allRows.reduce((s, r) => s + r.amount, 0)
  const grandTotalAfter = days.reduce((s, d) => s + d.totalAmount, 0)
  const totalsMatch = grandTotalBefore === grandTotalAfter

  // Group subtotals
  const groupTotalsParsed = { hmpt: 0, ddgd: 0, tpdg: 0, tpts: 0 }
  for (const row of allRows) {
    if (row.groupCode && groupTotalsParsed[row.groupCode] !== undefined) {
      groupTotalsParsed[row.groupCode] += row.amount
    }
  }

  const reconciliation = {
    grandTotalBefore,
    grandTotalAfter,
    totalsMatch,
    groupTotals: {
      hmpt: { parsed: groupTotalsParsed.hmpt, pdfSubtotal: null, match: null },
      ddgd: { parsed: groupTotalsParsed.ddgd, pdfSubtotal: null, match: null },
      tpdg: { parsed: groupTotalsParsed.tpdg, pdfSubtotal: null, match: null },
      tpts: { parsed: groupTotalsParsed.tpts, pdfSubtotal: null, match: null },
    },
    sourceRowCount: totalSourceRows,
    validRowCount: validRows,
    needsReviewRowCount: needsReviewRows,
    excludedRowCount: excludedRows,
    uniqueDateCount: uniqueDates,
    importableRowCount: days.filter(d => d.status === 'ready').length,
  }

  // ── Determine status ────────────────────────────────────────
  let status = 'success'
  let errorMessage = null

  if (validRows === 0 && needsReviewRows === 0) {
    status = 'error'
    errorMessage = 'Không có dòng doanh thu hợp lệ nào để tổng hợp.'
  } else if (!totalsMatch) {
    status = 'error'
    errorMessage = `Tổng không khớp: trước=${grandTotalBefore}, sau=${grandTotalAfter}, chênh=${grandTotalAfter - grandTotalBefore}`
  }

  return {
    days,
    reconciliation,
    totalSourceRows,
    validRows,
    needsReviewRows,
    excludedRows,
    uniqueDates,
    status,
    errorMessage,
  }
}

// ─────────────────────────────────────────
// Utility: format VND
// ─────────────────────────────────────────

/**
 * Format a VND amount (integer) as a display string.
 * e.g. 1350000 → "1.350.000"
 */
export function formatVnd(amount) {
  return amount.toLocaleString('vi-VN')
}
