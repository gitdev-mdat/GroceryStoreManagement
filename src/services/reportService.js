import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

const PAGE_SIZE = 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(value) {
  const match = ISO_DATE.exec(String(value || ''));
  if (!match) throw new Error('Kỳ báo cáo không hợp lệ.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const days = new Date(year, month, 0).getDate();
  if (year < 2000 || year > 9998 || month < 1 || month > 12 || day < 1 || day > days) throw new Error('Kỳ báo cáo không hợp lệ.');
  return { year, month, day };
}

const iso = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function periodBounds(mode, value) {
  if (!['day', 'month', 'year'].includes(mode)) throw new Error('Loại kỳ báo cáo không hợp lệ.');
  if (mode === 'year') {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 2000 || year > 9998) throw new Error('Kỳ báo cáo không hợp lệ.');
    return { mode, value: String(year), from: `${year}-01-01`, to: `${year + 1}-01-01`, label: `Năm ${year}` };
  }
  if (mode === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
    if (!match) throw new Error('Kỳ báo cáo không hợp lệ.');
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year < 2000 || year > 9998 || month < 1 || month > 12) throw new Error('Kỳ báo cáo không hợp lệ.');
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return { mode, value: `${year}-${match[2]}`, from: iso(year, month, 1), to: iso(nextYear, nextMonth, 1), label: `Tháng ${match[2]}/${year}` };
  }
  const { year, month, day } = parseDate(value);
  let nextDay = day + 1, nextMonth = month, nextYear = year;
  if (nextDay > new Date(year, month, 0).getDate()) { nextDay = 1; nextMonth += 1; }
  if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
  return { mode, value: iso(year, month, day), from: iso(year, month, day), to: iso(nextYear, nextMonth, nextDay), label: `Ngày ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` };
}

function summarize(rows) {
  let total = 0;
  let count = 0;
  let invalidCount = 0;
  for (const row of rows) {
    const raw = row.total_amount;
    const amount = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
    if (!Number.isFinite(amount) || amount < 0) { invalidCount += 1; continue; }
    total += amount;
    count += 1;
  }
  return { total, count, invalidCount };
}

async function readAll(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message || 'Không thể tải dữ liệu báo cáo.');
    const page = result.data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function fetchFinancialSummary(period, client = supabase) {
  if (client === supabase && !isSupabaseConfigured()) throw new Error('Supabase chưa được cấu hình.');
  const bounds = periodBounds(period?.mode, period?.value);
  const [invoices, sales] = await Promise.all([
    readAll(() => client.from('invoices').select('id,invoice_type,issue_date,total_amount').eq('invoice_type', 'VAT').gte('issue_date', bounds.from).lt('issue_date', bounds.to).order('issue_date').order('id')),
    readAll(() => client.from('sales_tickets').select('id,sale_date,total_amount').gte('sale_date', bounds.from).lt('sale_date', bounds.to).order('sale_date').order('id')),
  ]);
  return { period: bounds, vat: summarize(invoices), revenue: summarize(sales) };
}

export function formatReportCurrency(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  const safe = Object.is(Number(value), -0) ? 0 : Math.round(Number(value));
  return `${safe.toLocaleString('vi-VN')} ₫`;
}

export const REPORT_PAGE_SIZE = PAGE_SIZE;
export const __test__ = { summarize };
