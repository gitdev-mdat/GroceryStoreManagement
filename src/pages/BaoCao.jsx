import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileInput, RefreshCw, ShoppingBag } from 'lucide-react';
import { fetchFinancialSummary, formatReportCurrency, periodBounds } from '../services/reportService';

const MODES = [['day', 'Ngày'], ['month', 'Tháng'], ['year', 'Năm']];
const today = new Date();
const initial = {
  day: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
  year: String(today.getFullYear()),
};

function MetricCard({ icon: Icon, title, value, source, period, empty, tone = 'blue' }) {
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-center gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'}`}><Icon size={21} aria-hidden="true" /></span><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="text-xs text-slate-500">{source}</p></div></div>
    <p className={`mt-6 break-words text-3xl font-bold tabular-nums tracking-tight sm:text-4xl ${tone === 'green' ? 'text-emerald-700' : 'text-slate-900'}`}>{formatReportCurrency(value.total)}</p>
    <p className="mt-3 text-sm font-medium text-slate-700">{value.count.toLocaleString('vi-VN')} {value.invalidCount > 0 ? 'bản ghi hợp lệ' : 'bản ghi'}</p>
    <p className="mt-1 text-sm text-slate-500">{period}</p>
    {value.count === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{empty}</p>}
  </article>;
}

function Skeletons() { return <div className="grid gap-4 lg:grid-cols-2" aria-label="Đang tải dữ liệu báo cáo">{[0, 1].map(i => <div key={i} className="h-60 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"><div className="h-11 w-11 rounded-xl bg-slate-100"/><div className="mt-6 h-10 w-3/4 rounded bg-slate-100"/><div className="mt-5 h-4 w-1/2 rounded bg-slate-100"/></div>)}</div>; }

export default function BaoCao() {
  const [mode, setMode] = useState('month');
  const [values, setValues] = useState(initial);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: false });
  const request = useRef(0);
  const selected = values[mode];
  const period = useMemo(() => { try { return periodBounds(mode, selected); } catch { return null; } }, [mode, selected]);
  const load = useCallback(async () => {
    if (!period) return;
    const id = ++request.current;
    setState(previous => ({ loading: true, data: previous.data, error: false }));
    try { const data = await fetchFinancialSummary(period); if (id === request.current) setState({ loading: false, data, error: false }); }
    catch { if (id === request.current) setState({ loading: false, data: null, error: true }); }
  }, [period, refresh]);
  useEffect(() => { load(); }, [load]);
  const commitValue = (value) => setValues(previous => previous[mode] === value ? previous : { ...previous, [mode]: value });
  const invalid = (state.data?.vat.invalidCount || 0) + (state.data?.revenue.invalidCount || 0);

  return <div className="mx-auto w-full max-w-7xl">
    <header className="mb-6 lg:flex lg:items-end lg:justify-between lg:gap-8">
      <div><h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">Tổng quan tài chính</h1><p className="mt-2 text-sm text-slate-600">Giá trị hóa đơn VAT đầu vào và doanh thu bán hàng trong cùng một kỳ.</p></div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:mt-0">
        <div><span className="mb-1.5 block text-xs font-semibold text-slate-600">Loại kỳ</span><div className="inline-flex min-h-11 rounded-xl border border-slate-300 bg-white p-1" role="group" aria-label="Chọn loại kỳ báo cáo">{MODES.map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={`min-h-9 rounded-lg px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 ${mode === id ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}</div></div>
        <div className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Kỳ báo cáo</span>{mode === 'month' ? <div className="flex gap-2">
          <label className="sr-only" htmlFor="report-month">Tháng</label><select id="report-month" value={selected.slice(5, 7)} onChange={e => commitValue(`${selected.slice(0, 4)}-${e.target.value}`)} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-600 sm:w-32" aria-label="Chọn tháng">{Array.from({ length: 12 }, (_, index) => { const month = String(index + 1).padStart(2, '0'); return <option key={month} value={month}>Tháng {month}</option>; })}</select>
          <label className="sr-only" htmlFor="report-month-year">Năm</label><input id="report-month-year" aria-label="Chọn năm" type="number" min="2000" max="9998" defaultValue={selected.slice(0, 4)} key={`month-year-${selected.slice(0, 4)}`} onBlur={e => { const year = e.currentTarget.value; if (/^\d{4}$/.test(year) && Number(year) >= 2000 && Number(year) <= 9998) commitValue(`${year}-${selected.slice(5, 7)}`); else e.currentTarget.value = selected.slice(0, 4); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} className="h-11 w-24 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-600" />
        </div> : <input aria-label={`Chọn ${MODES.find(([id]) => id === mode)[1].toLowerCase()}`} type={mode === 'day' ? 'date' : 'number'} min={mode === 'year' ? '2000' : undefined} max={mode === 'year' ? '9998' : undefined} value={selected} onChange={e => commitValue(e.target.value)} className="h-11 w-full min-w-[170px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-600 sm:w-auto" />}</div>
        <button type="button" disabled={state.loading || !period} onClick={() => setRefresh(value => value + 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white outline-none hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"><RefreshCw size={17} className={state.loading ? 'animate-spin' : ''}/>Làm mới</button>
      </div>
    </header>
    <p className="mb-4 text-sm text-slate-600"><span className="font-semibold text-slate-800">Đang xem:</span> {period?.label}</p>
    {state.loading && !state.data ? <Skeletons /> : state.error ? <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-red-700">Không thể tải dữ liệu báo cáo</h2><p className="mt-2 text-sm text-slate-600">Vui lòng kiểm tra kết nối và thử lại với kỳ đang chọn.</p><button onClick={() => setRefresh(value => value + 1)} className="mt-5 min-h-11 rounded-xl bg-brand-700 px-5 font-semibold text-white focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2">Thử lại</button></div> : state.data && <>
      <div className={`grid gap-4 lg:grid-cols-2 ${state.loading ? 'opacity-60' : ''}`} aria-busy={state.loading}>
        <MetricCard icon={FileInput} title="Hóa đơn VAT đầu vào" source="Nguồn: Hóa đơn VAT đã ghi nhận" value={state.data.vat} period={state.data.period.label} empty="Không có hóa đơn VAT đầu vào hợp lệ trong kỳ này." />
        <MetricCard icon={ShoppingBag} title="Doanh thu bán hàng" source="Nguồn: Phiếu bán hàng đã ghi nhận" value={state.data.revenue} period={state.data.period.label} empty="Không có phiếu bán hàng hợp lệ trong kỳ này." tone="green" />
      </div>
      {invalid > 0 && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Đã loại {invalid.toLocaleString('vi-VN')} bản ghi có tổng tiền không hợp lệ hoặc âm; số lượng và tổng tiền chỉ tính các bản ghi hợp lệ.</p>}
    </>}
  </div>;
}
