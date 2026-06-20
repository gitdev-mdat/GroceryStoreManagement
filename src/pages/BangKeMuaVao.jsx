import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { formatVndExact } from '../components/FormatNumber'
import VndInput from '../components/VndInput'
import DatePicker from '../components/DatePicker'
import { formatDateForInput, formatDateDisplay } from '../components/FormatDate'
import {
  ShoppingCart,
  ClipboardList,
  CalendarDays,
  Trash2,
  Plus,
  Check,
  X,
  FileX,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Empty State sub-component
───────────────────────────────────────────── */
function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
        <FileX size={22} strokeWidth={1.5} className="text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500">Chưa có dữ liệu</p>
        <p className="mt-0.5 text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main component — data logic UNCHANGED
───────────────────────────────────────────── */
export default function BangKeMuaVao() {
  const {
    freshFoodPurchases,
    setFreshFoodPurchaseForMonth,
    deleteFreshFoodPurchase,
    freshFoodPurchasesDaily,
    setFreshFoodPurchaseForDay,
    deleteFreshFoodPurchaseDay,
  } = useApp()

  const [mode,      setMode]      = useState('thang')
  const [month,     setMonth]     = useState(new Date().getMonth() + 1)
  const [year,      setYear]      = useState(new Date().getFullYear())
  const [amount,    setAmount]    = useState(0)
  const [dayDate,   setDayDate]   = useState(formatDateForInput(new Date()))
  const [dayAmount, setDayAmount] = useState(0)
  const [notify,    setNotify]    = useState(null)

  const monthKey    = `${year}-${String(month).padStart(2, '0')}`
  const existing    = (freshFoodPurchases || []).find((e) => e.month === monthKey)
  const existingDay = (freshFoodPurchasesDaily || []).find((e) => e.date === dayDate)

  useEffect(() => {
    const entry = (freshFoodPurchases || []).find((e) => e.month === monthKey)
    setAmount(entry ? (entry.amount ?? 0) : 0)
  }, [monthKey, freshFoodPurchases])

  useEffect(() => {
    const entry = (freshFoodPurchasesDaily || []).find((e) => e.date === dayDate)
    setDayAmount(entry ? (entry.amount ?? 0) : 0)
  }, [dayDate, freshFoodPurchasesDaily])

  useEffect(() => {
    if (!notify) return
    const t = setTimeout(() => setNotify(null), 3000)
    return () => clearTimeout(t)
  }, [notify])

  const handleSaveMonth = () => {
    setFreshFoodPurchaseForMonth(monthKey, amount)
    setNotify({
      type: 'success',
      text: existing
        ? `Đã cập nhật bảng kê tháng ${month}/${year}.`
        : `Đã lưu bảng kê tháng ${month}/${year}.`,
    })
  }

  const handleSaveDay = () => {
    setFreshFoodPurchaseForDay(dayDate, dayAmount)
    setNotify({
      type: 'success',
      text: existingDay
        ? `Đã cập nhật bảng kê ngày ${formatDateDisplay(dayDate)}.`
        : `Đã lưu bảng kê ngày ${formatDateDisplay(dayDate)}.`,
    })
  }

  const sorted      = [...(freshFoodPurchases || [])].sort((a, b) => b.month.localeCompare(a.month))
  const sortedDaily = [...(freshFoodPurchasesDaily || [])].sort((a, b) => b.date.localeCompare(a.date))

  /* ══════════════════════════════════════════
     Render
  ══════════════════════════════════════════ */
  return (
    <div className="space-y-6">

      {/* ════════════════════════════════════════
          Page header
      ════════════════════════════════════════ */}
      <div className="flex items-center gap-4">
        <div className="
          flex h-12 w-12 shrink-0 items-center justify-center
          rounded-xl border border-brand-100 bg-brand-50
          shadow-[0_0_0_4px_rgba(37,99,235,0.06)]
        ">
          <ShoppingCart size={22} strokeWidth={1.75} className="text-brand-600" />
        </div>
        <div>
          <h1 className="m-0 text-xl font-bold leading-snug text-slate-900">
            Bảng kê mua vào
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Thực phẩm tươi sống — không có hóa đơn VAT
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════
          Input form card
      ════════════════════════════════════════ */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08),_0_1px_4px_rgba(15,23,42,0.04)]">

        {/* Card header */}
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Nhập bảng kê
          </p>
        </div>

          {/* ── Inner content: max-w-xl centered ── */}
          <div className="px-6 py-6">
          <div className="mx-auto w-full max-w-xl">

          {/* ── Segmented control — centered ── */}
          <div className="mb-6 flex justify-center">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-1">
            {[
              { value: 'thang', label: 'Theo tháng' },
              { value: 'ngay',  label: 'Theo ngày'  },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`
                  rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-150
                  ${mode === value
                    ? 'bg-white text-brand-700 shadow-sm shadow-slate-200/80'
                    : 'text-slate-600 hover:text-slate-800'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
          </div>

          {/* ── Mode: Theo tháng ── */}
          {mode === 'thang' && (
            <div>
              {/* Row 1: Tháng + Năm — equal 50/50 */}
              <div className="mb-4 grid grid-cols-2 gap-4">
                {/* Tháng */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tháng
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="
                      h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50
                      px-3 text-sm font-medium text-slate-800
                      transition-all duration-150
                      hover:border-slate-300 hover:bg-white
                      focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100
                    "
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>

                {/* Năm */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Năm
                  </label>
                  <input
                    type="number"
                    min={2020}
                    max={2030}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
                    className="
                      h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50
                      px-3 text-sm font-medium text-slate-800 tabular-nums
                      transition-all duration-150
                      hover:border-slate-300 hover:bg-white
                      focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100
                    "
                  />
                </div>
              </div>

              {/* Row 2: Tổng tiền — full width */}
              <div className="mb-5 flex flex-col gap-1.5">
                <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tổng tiền mua vào tháng
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative flex w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all duration-150 hover:border-slate-300 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
                  <VndInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="0"
                    className="!h-[42px] !flex-1 !border-0 !bg-transparent !pr-8 !text-right !text-base !font-bold !shadow-none !ring-0 !outline-none tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3.5 text-sm font-semibold text-slate-400">
                    đ
                  </span>
                </div>
              </div>

              {/* Save button — full width */}
              <button
                type="button"
                onClick={handleSaveMonth}
                className="
                  flex min-h-[44px] w-full items-center justify-center gap-2
                  rounded-xl bg-gradient-to-r from-brand-600 to-brand-700
                  px-6 py-2.5 text-sm font-semibold text-white
                  shadow-[0_4px_16px_-2px_rgba(37,99,235,0.35)]
                  transition-all duration-200
                  hover:-translate-y-px hover:shadow-[0_6px_20px_-2px_rgba(37,99,235,0.45)]
                  active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-300
                "
              >
                <Plus size={15} strokeWidth={2.5} />
                {existing ? 'Cập nhật bảng kê' : 'Lưu bảng kê'}
              </button>
            </div>
          )}

          {/* ── Mode: Theo ngày ── */}
          {mode === 'ngay' && (
            <div>
              {/* Row 1: Ngày — full width */}
              <div className="mb-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ngày
                </label>
                <div className="flex w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all duration-150 hover:border-slate-300 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
                  <DatePicker
                    value={dayDate}
                    onChange={setDayDate}
                    aria-label="Chọn ngày"
                    className="!h-[42px] !flex-1 !border-0 !bg-transparent !shadow-none !text-sm !font-medium !text-slate-800 !px-3"
                  />
                </div>
              </div>

              {/* Row 2: Tổng tiền ngày — full width */}
              <div className="mb-5 flex flex-col gap-1.5">
                <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tổng tiền mua vào ngày
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative flex w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all duration-150 hover:border-slate-300 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
                  <VndInput
                    value={dayAmount}
                    onChange={setDayAmount}
                    placeholder="0"
                    className="!h-[42px] !flex-1 !border-0 !bg-transparent !pr-8 !text-right !text-base !font-bold !shadow-none !ring-0 !outline-none tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3.5 text-sm font-semibold text-slate-400">
                    đ
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="mb-5 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              {/* Save button — full width */}
              <button
                type="button"
                onClick={handleSaveDay}
                className="
                  flex min-h-[44px] w-full items-center justify-center gap-2
                  rounded-xl bg-gradient-to-r from-brand-600 to-brand-700
                  px-6 py-2.5 text-sm font-semibold text-white
                  shadow-[0_4px_16px_-2px_rgba(37,99,235,0.35)]
                  transition-all duration-200
                  hover:-translate-y-px hover:shadow-[0_6px_20px_-2px_rgba(37,99,235,0.45)]
                  active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-300
                "
              >
                <Plus size={15} strokeWidth={2.5} />
                {existingDay ? 'Cập nhật bảng kê' : 'Lưu bảng kê'}
              </button>
            </div>
          )}

          {/* ── Toast notify ── */}
          {notify && (
            <div
              role="alert"
              className={`
                mt-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium
                ${notify.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
                }
              `}
            >
              <div className={`
                flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                ${notify.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}
              `}>
                {notify.type === 'success'
                  ? <Check size={12} strokeWidth={2.5} className="text-emerald-600" />
                  : <X     size={12} strokeWidth={2.5} className="text-red-600" />
                }
              </div>
              {notify.text}
            </div>
          )}
        </div>{/* end max-w-xl */}
      </div>{/* end px-6 py-6 */}
      </div>{/* end form card */}

      {/* ════════════════════════════════════════
          Saved list card
      ════════════════════════════════════════ */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08),_0_1px_4px_rgba(15,23,42,0.04)]">

        {/* Card header */}
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={15} strokeWidth={2} className="text-slate-400" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Danh sách bảng kê đã lưu
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">

          {/* ── Section: Theo tháng ── */}
          <div className="px-6 py-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
              <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
              Theo tháng
              {sorted.length > 0 && (
                <span className="ml-1 rounded-full bg-brand-100 px-2 py-px text-[11px] font-bold text-brand-700">
                  {sorted.length}
                </span>
              )}
            </h3>

            {sorted.length === 0 ? (
              <EmptyState label="Chưa có bảng kê theo tháng nào được lưu" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Tháng
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Tổng tiền (VND)
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                        &nbsp;
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sorted.map((row) => (
                      <tr key={row.month} className="group">
                        <td className="py-3 font-medium text-slate-800">
                          Tháng {row.month.slice(5)}/{row.month.slice(0, 4)}
                        </td>
                        <td className="py-3 text-right font-bold tabular-nums text-slate-900">
                          {formatVndExact(row.amount)}
                          <span className="ml-1 text-xs font-semibold text-slate-400">đ</span>
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteFreshFoodPurchase(row.month)}
                            className="
                              inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                              px-2.5 py-1.5 text-xs font-medium text-slate-500
                              transition-all duration-150
                              hover:border-red-200 hover:bg-red-50 hover:text-red-600
                              focus:outline-none
                            "
                          >
                            <Trash2 size={12} strokeWidth={2} />
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Section: Theo ngày ── */}
          <div className="px-6 py-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Theo ngày
              {sortedDaily.length > 0 && (
                <span className="ml-1 rounded-full bg-emerald-100 px-2 py-px text-[11px] font-bold text-emerald-700">
                  {sortedDaily.length}
                </span>
              )}
            </h3>

            {sortedDaily.length === 0 ? (
              <EmptyState label="Chưa có bảng kê theo ngày nào được lưu" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Ngày
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Tổng tiền (VND)
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                        &nbsp;
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedDaily.map((row) => (
                      <tr key={row.date} className="group">
                        <td className="py-3 font-medium text-slate-800">
                          {formatDateDisplay(row.date)}
                        </td>
                        <td className="py-3 text-right font-bold tabular-nums text-slate-900">
                          {formatVndExact(row.amount)}
                          <span className="ml-1 text-xs font-semibold text-slate-400">đ</span>
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteFreshFoodPurchaseDay(row.date)}
                            className="
                              inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                              px-2.5 py-1.5 text-xs font-medium text-slate-500
                              transition-all duration-150
                              hover:border-red-200 hover:bg-red-50 hover:text-red-600
                              focus:outline-none
                            "
                          >
                            <Trash2 size={12} strokeWidth={2} />
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
