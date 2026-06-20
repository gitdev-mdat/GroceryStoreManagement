import { useState, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { formatVnd, roundToThousands, formatVndInputDisplay, parseVndInput } from '../FormatNumber'
import {
  ArrowLeft,
  CalendarRange,
  Layers,
  ChevronDown,
  Check,
  X,
  Loader2,
  AlertCircle,
  TrendingUp,
  ShoppingBag,
  Droplets,
  Package,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Data — không thay đổi
───────────────────────────────────────────── */
const INDUSTRY_GROUPS = [
  { id: 'do-dung-gia-dinh', label: 'Nhóm Đồ dùng gia đình & Tiện ích', Icon: ShoppingBag },
  { id: 'hoa-my-pham',      label: 'Nhóm Hóa mỹ phẩm & Tẩy rửa',       Icon: Droplets   },
  { id: 'thuc-pham-dong-goi', label: 'Nhóm Thực phẩm đóng gói & Đồ uống', Icon: Package  },
]

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function AddMonthlyRevenueForm({ onBack, onNotify, onRefresh }) {
  const now          = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()

  const [selectedMonth,     setSelectedMonth]     = useState(currentMonth)
  const [selectedYear,      setSelectedYear]       = useState(currentYear)
  const [groupId,           setGroupId]            = useState('do-dung-gia-dinh')
  const [amountRaw,         setAmountRaw]          = useState('')
  const [amountDisplay,     setAmountDisplay]      = useState('')
  const [submitting,        setSubmitting]         = useState(false)
  const [submitSuccess,     setSubmitSuccess]      = useState(false)
  const [isOpenMonthSheet,  setIsOpenMonthSheet]   = useState(false)
  const [isOpenGroupSheet,  setIsOpenGroupSheet]   = useState(false)
  const [errors,            setErrors]             = useState({})
  const [toast,             setToast]              = useState(null)
  const amountInputRef = useRef(null)

  /* Month options */
  const monthOptions = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    monthOptions.push({
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: `Tháng ${String(m).padStart(2, '0')}/${y}`,
      month: m,
      year: y,
    })
  }

  const selectedGroup     = INDUSTRY_GROUPS.find(g => g.id === groupId)
  const selectedGroupName = selectedGroup?.label ?? 'Nhóm Đồ dùng gia đình & Tiện ích'

  /* ── Helpers ── */
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }

  /* ── Currency handlers (logic unchanged) ── */
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    setAmountRaw(raw)
    setAmountDisplay(formatVndInputDisplay(raw))
    if (errors.amount) setErrors(prev => ({ ...prev, amount: null }))
  }
  const handleAmountBlur = () => {
    if (amountRaw && Number(amountRaw) > 0) setAmountDisplay(formatVndInputDisplay(amountRaw))
  }
  const handleAmountFocus = () => {
    if (amountRaw) setAmountDisplay(amountRaw)
  }

  /* ── Submit (logic unchanged) ── */
  const handleSubmit = async (e) => {
    e?.preventDefault()
    const amount = parseVndInput(amountRaw)

    if (!amountRaw || amount <= 0) {
      setErrors({ amount: 'Vui lòng nhập số tiền doanh thu' })
      return
    }

    setSubmitting(true)
    try {
      if (!isSupabaseConfigured()) throw new Error('Chưa kết nối Supabase')

      const saleDate     = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const ticketNumber = `S1A-${Date.now().toString(36).toUpperCase()}`

      const { error } = await supabase
        .from('sales_tickets')
        .insert([{
          ticket_number: ticketNumber,
          sale_date:     saleDate,
          total_amount:  Number(roundToThousands(amount)),
          group_key:     selectedGroupName,
          notes:         'Nhập nhanh doanh thu từ form tổng hợp',
        }])

      if (error) throw error

      setSubmitSuccess(true)
      setAmountRaw('')
      setAmountDisplay('')
      showToast(`Đã thêm doanh thu tháng ${selectedMonth}/${selectedYear}: ${formatVnd(amount)} VND.`)
      onRefresh?.()
      setTimeout(() => onBack?.(), 1800)
    } catch (err) {
      console.error('Lỗi thêm doanh thu tháng:', err)
      showToast(err.message || 'Không thể lưu doanh thu tháng.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const parsedAmount  = parseVndInput(amountRaw)
  const hasValidAmount = amountDisplay && Number(amountRaw) > 0

  /* ══════════════════════════════════════════
     Render
  ══════════════════════════════════════════ */
  return (
    <>
      {/* ════════════════════════════════════════
          Page shell — centered max-w-[640px]
      ════════════════════════════════════════ */}
      <div className="mx-auto w-full max-w-[640px] px-0 pb-16">

        {/* ── Back button ── */}
        <button
          onClick={onBack}
          className="
            mb-6 inline-flex items-center gap-2
            rounded-lg border border-slate-200 bg-white
            px-3.5 py-2 text-sm font-medium text-slate-500
            shadow-sm transition-all duration-150
            hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700
            focus:outline-none focus:ring-2 focus:ring-brand-100
          "
        >
          <ArrowLeft size={15} strokeWidth={2.25} />
          Quay lại
        </button>

        {/* ── Page header ── */}
        <div className="mb-8 flex items-start gap-4">
          <div className="
            flex h-12 w-12 shrink-0 items-center justify-center
            rounded-xl border border-brand-100 bg-brand-50
            shadow-[0_0_0_4px_rgba(37,99,235,0.06)]
          ">
            <TrendingUp size={22} strokeWidth={1.75} className="text-brand-600" />
          </div>
          <div className="pt-0.5">
            <h2 className="m-0 text-xl font-bold leading-snug text-slate-900">
              Thêm doanh thu tháng
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nhập nhanh doanh thu tổng hợp theo tháng
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════
            Form card
        ════════════════════════════════════════ */}
        <div className="
          overflow-hidden rounded-2xl border border-slate-200 bg-white
          shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08),_0_1px_4px_rgba(15,23,42,0.04)]
        ">
          {/* Card header strip */}
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Thông tin doanh thu
            </p>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="px-4 py-5 sm:px-6 sm:py-6">

            {/* ── Row: Tháng + Nhóm hàng hóa (2-col on sm+) ── */}
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Field: Tháng */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tháng
                </label>
                <button
                  type="button"
                  onClick={() => setIsOpenMonthSheet(true)}
                  className="
                    flex h-[42px] w-full items-center justify-between gap-2
                    rounded-xl border border-slate-200 bg-slate-50
                    px-3.5 text-sm font-medium text-slate-800
                    transition-all duration-150
                    hover:border-slate-300 hover:bg-white
                    focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100
                  "
                >
                  <div className="flex items-center gap-2">
                    <CalendarRange size={15} strokeWidth={1.75} className="text-slate-400" />
                    <span>Tháng {String(selectedMonth).padStart(2, '0')} / {selectedYear}</span>
                  </div>
                  <ChevronDown size={15} strokeWidth={2.25} className="shrink-0 text-slate-400" />
                </button>
              </div>

              {/* Field: Nhóm hàng hóa */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nhóm hàng hóa
                </label>
                <button
                  type="button"
                  onClick={() => setIsOpenGroupSheet(true)}
                  className="
                    flex h-[42px] w-full items-center justify-between gap-2
                    rounded-xl border border-slate-200 bg-slate-50
                    px-3.5 text-sm font-medium text-slate-800
                    transition-all duration-150
                    hover:border-slate-300 hover:bg-white
                    focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100
                  "
                >
                  <span className="truncate text-left">{selectedGroupName}</span>
                  <ChevronDown size={15} strokeWidth={2.25} className="shrink-0 text-slate-400" />
                </button>
              </div>
            </div>

            {/* ── Field: Số tiền ── */}
            <div className="mb-8">
              <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Số tiền doanh thu
                <span className="text-red-500">*</span>
              </label>

              <div className={`
                relative flex items-center overflow-hidden rounded-xl border bg-slate-50 transition-all duration-150
                focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100
                ${errors.amount
                  ? 'border-red-300 ring-2 ring-red-100'
                  : 'border-slate-200 hover:border-slate-300'
                }
              `}>
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="numeric"
                  value={amountDisplay}
                  onChange={handleAmountChange}
                  onFocus={handleAmountFocus}
                  onBlur={handleAmountBlur}
                  placeholder="0"
                  className="
                    h-[42px] min-w-0 flex-1 bg-transparent
                    pl-3.5 pr-10 text-right
                    text-base font-bold tabular-nums tracking-tight text-slate-900
                    placeholder:font-normal placeholder:text-slate-300
                    focus:outline-none
                  "
                />
                <span className="pointer-events-none absolute right-3.5 select-none text-sm font-semibold text-slate-400">
                  đ
                </span>
              </div>

              {/* Live preview */}
              {hasValidAmount && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2">
                  <Check size={13} strokeWidth={2.5} className="shrink-0 text-brand-500" />
                  <span className="text-xs font-medium text-brand-700 tabular-nums">
                    = <strong className="font-bold">{formatVnd(parsedAmount)}</strong> đồng
                  </span>
                </div>
              )}

              {errors.amount && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-500">
                  <AlertCircle size={11} strokeWidth={2.5} />
                  {errors.amount}
                </p>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

            {/* ── Action buttons ── */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onBack}
                className="
                  flex min-h-[44px] w-full items-center justify-center gap-2
                  rounded-xl border border-slate-200 bg-white
                  px-5 py-2.5 text-sm font-medium text-slate-600
                  shadow-sm transition-all duration-150
                  hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-brand-100
                  sm:w-auto
                "
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={submitting}
                className={`
                  flex min-h-[44px] w-full items-center justify-center gap-2
                  rounded-xl px-6 py-2.5 text-sm font-semibold text-white
                  shadow-[0_4px_16px_-2px_rgba(37,99,235,0.35)]
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-brand-300
                  disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none
                  sm:w-auto
                  ${submitSuccess
                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 shadow-[0_4px_16px_-2px_rgba(16,185,129,0.35)]'
                    : 'bg-gradient-to-r from-brand-600 to-brand-700 hover:-translate-y-px hover:shadow-[0_6px_20px_-2px_rgba(37,99,235,0.45)] active:scale-[0.98]'
                  }
                `}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                    Đang lưu...
                  </>
                ) : submitSuccess ? (
                  <>
                    <Check size={16} strokeWidth={2.5} />
                    Đã lưu!
                  </>
                ) : (
                  <>
                    <TrendingUp size={16} strokeWidth={2} />
                    Thêm doanh thu
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* ── Footer note ── */}
        <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
          Dữ liệu lưu vào Sổ S1A-HKD theo Thông tư 152/2025/TT-BTC
        </p>
      </div>

      {/* ════════════════════════════════════════
          Month selector — Bottom Sheet / Dropdown
      ════════════════════════════════════════ */}
      {isOpenMonthSheet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsOpenMonthSheet(false)}
            style={{ animation: 'amrf-fade-in 0.2s ease' }}
          />
          <div
            className="
              fixed bottom-0 left-0 right-0 z-50
              rounded-t-3xl border-t border-slate-200 bg-white
              shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.2)]
            "
            style={{ animation: 'amrf-sheet-up 0.3s cubic-bezier(0.32,0.72,0,1)' }}
          >
            {/* Handle */}
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-300" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-sm font-bold text-slate-800">Chọn tháng</p>
              <button
                type="button"
                onClick={() => setIsOpenMonthSheet(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={16} strokeWidth={2.25} />
              </button>
            </div>

            <div className="mx-5 h-px bg-slate-100" />

            {/* List */}
            <ul className="max-h-72 overflow-y-auto p-3 pb-6">
              {monthOptions.map((opt) => {
                const isActive = selectedMonth === opt.month && selectedYear === opt.year
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMonth(opt.month)
                        setSelectedYear(opt.year)
                        setIsOpenMonthSheet(false)
                      }}
                      className={`
                        flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-sm
                        transition-colors duration-100
                        ${isActive
                          ? 'bg-brand-50 font-semibold text-brand-700'
                          : 'font-medium text-slate-700 hover:bg-slate-50'
                        }
                      `}
                    >
                      <span>{opt.label}</span>
                      {isActive && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600">
                          <Check size={11} strokeWidth={3} className="text-white" />
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          Group selector — Bottom Sheet
      ════════════════════════════════════════ */}
      {isOpenGroupSheet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsOpenGroupSheet(false)}
            style={{ animation: 'amrf-fade-in 0.2s ease' }}
          />
          <div
            className="
              fixed bottom-0 left-0 right-0 z-50
              rounded-t-3xl border-t border-slate-200 bg-white
              shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.2)]
            "
            style={{ animation: 'amrf-sheet-up 0.3s cubic-bezier(0.32,0.72,0,1)' }}
          >
            {/* Handle */}
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-300" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-sm font-bold text-slate-800">Chọn nhóm hàng hóa</p>
              <button
                type="button"
                onClick={() => setIsOpenGroupSheet(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={16} strokeWidth={2.25} />
              </button>
            </div>

            <div className="mx-5 h-px bg-slate-100" />

            {/* List */}
            <ul className="p-3 pb-6">
              {INDUSTRY_GROUPS.map(({ id, label, Icon }) => {
                const isActive = groupId === id
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => { setGroupId(id); setIsOpenGroupSheet(false) }}
                      className={`
                        flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left
                        transition-colors duration-100
                        ${isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-700 hover:bg-slate-50'
                        }
                      `}
                    >
                      <div className={`
                        flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                        ${isActive ? 'bg-brand-100' : 'bg-slate-100'}
                      `}>
                        <Icon size={16} strokeWidth={1.75} className={isActive ? 'text-brand-600' : 'text-slate-500'} />
                      </div>
                      <span className={`flex-1 text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                        {label}
                      </span>
                      {isActive && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600">
                          <Check size={11} strokeWidth={3} className="text-white" />
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          Toast
      ════════════════════════════════════════ */}
      {toast && (
        <div
          className={`
            fixed left-1/2 top-6 z-[100] flex -translate-x-1/2 items-center gap-2.5
            whitespace-nowrap rounded-2xl px-4 py-3
            shadow-[0_8px_32px_-4px_rgba(15,23,42,0.2)] backdrop-blur-md
            ${toast.type === 'success'
              ? 'border border-slate-200/80 bg-white/95 text-slate-800'
              : 'border border-red-200 bg-red-50/95 text-red-800'
            }
          `}
          style={{ animation: 'amrf-toast-drop 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <div className={`
            flex h-6 w-6 shrink-0 items-center justify-center rounded-full
            ${toast.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}
          `}>
            {toast.type === 'success'
              ? <Check size={13} strokeWidth={2.5} className="text-emerald-600" />
              : <X    size={13} strokeWidth={2.5} className="text-red-600" />
            }
          </div>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes amrf-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes amrf-sheet-up {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes amrf-toast-drop {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.94); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)      scale(1); }
        }
      `}</style>
    </>
  )
}
