import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__, fetchFinancialSummary, formatReportCurrency, periodBounds, REPORT_PAGE_SIZE } from '../src/services/reportService.js'

test('day, month and year bounds are exact, half-open and calendar-safe', () => {
  assert.deepEqual(periodBounds('day', '2024-02-29'), { mode: 'day', value: '2024-02-29', from: '2024-02-29', to: '2024-03-01', label: 'Ngày 29/02/2024' })
  assert.equal(periodBounds('month', '2026-12').to, '2027-01-01')
  assert.equal(periodBounds('year', '2026').to, '2027-01-01')
  assert.throws(() => periodBounds('day', '2025-02-29'), /không hợp lệ/)
})

test('summary skips invalid and negative totals and counts included zero', () => {
  assert.deepEqual(__test__.summarize([{ total_amount: 0 }, { total_amount: '12.5' }, { total_amount: -1 }, { total_amount: null }, { total_amount: 'x' }]), { total: 12.5, count: 2, invalidCount: 3 })
  assert.deepEqual(__test__.summarize([]), { total: 0, count: 0, invalidCount: 0 })
  assert.equal(formatReportCurrency(-0), '0 ₫')
  assert.equal(formatReportCurrency(NaN), '—')
})

function clientFor(tableRows, rejectTable) {
  const calls = []
  return { calls, from(table) {
    const filters = []
    const query = {
      select(columns) { calls.push({ table, columns, filters }); return query },
      eq(...args) { filters.push(['eq', ...args]); return query }, gte(...args) { filters.push(['gte', ...args]); return query },
      lt(...args) { filters.push(['lt', ...args]); return query }, order(...args) { calls.push({ table, order: args }); return query },
      async range(from, to) { calls.push({ table, from, to, filters: [...filters] }); return table === rejectTable ? { error: { message: 'boom' } } : { data: (tableRows[table] || []).slice(from, to + 1), error: null } }
    }
    return query
  } }
}

test('queries VAT invoices and sales with identical bounds and totals/counts', async () => {
  const client = clientFor({ invoices: [{ total_amount: 10 }, { total_amount: -2 }], sales_tickets: [{ total_amount: 20 }] })
  const result = await fetchFinancialSummary({ mode: 'month', value: '2026-09' }, client)
  assert.deepEqual(result.vat, { total: 10, count: 1, invalidCount: 1 })
  assert.deepEqual(result.revenue, { total: 20, count: 1, invalidCount: 0 })
  const ranges = client.calls.filter(call => call.filters)
  assert.ok(ranges.some(call => call.table === 'invoices' && call.filters.some(f => f.join() === 'eq,invoice_type,VAT')))
  assert.deepEqual(client.calls.filter(call => call.table === 'invoices' && call.order).map(call => call.order[0]), ['issue_date', 'id'])
  assert.deepEqual(client.calls.filter(call => call.table === 'sales_tickets' && call.order).map(call => call.order[0]), ['sale_date', 'id'])
  for (const call of ranges) {
    assert.ok(call.filters.some(f => f.join() === `gte,${call.table === 'invoices' ? 'issue_date' : 'sale_date'},2026-09-01`))
    assert.ok(call.filters.some(f => f.join() === `lt,${call.table === 'invoices' ? 'issue_date' : 'sale_date'},2026-10-01`))
  }
})

test('paginates beyond one query limit without truncating and propagates failures', async () => {
  const many = Array.from({ length: REPORT_PAGE_SIZE + 1 }, () => ({ total_amount: 1 }))
  const client = clientFor({ invoices: many, sales_tickets: [] })
  const result = await fetchFinancialSummary({ mode: 'year', value: 2026 }, client)
  assert.equal(result.vat.total, REPORT_PAGE_SIZE + 1)
  assert.equal(result.vat.count, REPORT_PAGE_SIZE + 1)
  assert.equal(client.calls.filter(c => c.table === 'invoices' && Number.isInteger(c.from)).length, 2)
  await assert.rejects(fetchFinancialSummary({ mode: 'day', value: '2026-09-23' }, clientFor({}, 'sales_tickets')), /boom/)
})

test('all modes preserve selected strings without UTC conversion', () => {
  assert.equal(periodBounds('day', '2026-09-23').from, '2026-09-23')
  assert.equal(periodBounds('month', '2026-09').from, '2026-09-01')
  assert.equal(periodBounds('year', 2026).from, '2026-01-01')
})
