import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Data — không thay đổi
───────────────────────────────────────────── */
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function CloseBookForm({ onBack, onNotify, onRefresh }) {
  const { closedPeriods, setClosedPeriods } = useApp()

  const [closeBookMonth, setCloseBookMonth] = useState(new Date().getMonth() + 1)
  const [closeBookYear,  setCloseBookYear]  = useState(new Date().getFullYear())
  const [submitting,     setSubmitting]     = useState(false)

  /* ── Logic handlers — unchanged ── */
  const handleCloseBook = async () => {
    const ym = `${closeBookYear}-${String(closeBookMonth).padStart(2, '0')}`

    if (closedPeriods.includes(ym)) {
      onNotify?.({ type: 'error', text: `Tháng ${closeBookMonth}/${closeBookYear} đã được chốt sổ.` })
      return
    }

    setSubmitting(true)
    try {
      if (!isSupabaseConfigured()) throw new Error('Chưa kết nối Supabase')

      const { error } = await supabase
        .from('closed_periods')
        .insert([{ period_month: ym }])

      if (error) throw error

      setClosedPeriods([...closedPeriods, ym].sort())
      onNotify?.({ type: 'success', text: `Đã chốt sổ tháng ${closeBookMonth}/${closeBookYear}.` })
      onRefresh?.()
    } catch (err) {
      console.error('Lỗi chốt sổ:', err)
      onNotify?.({ type: 'error', text: 'Không thể chốt sổ. Vui lòng thử lại.' })
    } finally {
      setSubmitting(false)
    }
  }

  const isPeriodClosed = (m, y) => {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    return closedPeriods.includes(ym)
  }

  /* ── Derived state ── */
  const selectedIsClosed = isPeriodClosed(closeBookMonth, closeBookYear)

  /* ══════════════════════════════════════════
     Render
  ══════════════════════════════════════════ */
  return (
    <div className="mx-auto w-full max-w-[480px] px-0 pb-20">

      {/* ════════════════════════════════════════
          Back button
      ════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════
          Page header
      ════════════════════════════════════════ */}
      <div className="mb-6 flex items-start gap-4">
        <div className="
          flex h-12 w-12 shrink-0 items-center justify-center
          rounded-xl border border-brand-100 bg-brand-50
          shadow-[0_0_0_4px_rgba(37,99,235,0.06)]
        ">
          <Lock size={20} strokeWidth={1.75} className="text-brand-600" />
        </div>
        <div className="pt-0.5">
          <h2 className="m-0 text-xl font-bold leading-snug text-slate-900">
            Chốt sổ S1A
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Khóa số liệu kỳ kê khai theo tháng
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════
          Warning card — serious, irreversible
      ════════════════════════════════════════ */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <AlertTriangle size={17} strokeWidth={2.25} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-800">
            Thao tác không thể hoàn tác
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">
            Sau khi chốt sổ, toàn bộ phiếu trong kỳ đó sẽ bị khóa — không thể chỉnh sửa
            hoặc xóa. Chỉ thực hiện khi đã kết thúc tháng kê khai để đảm bảo minh bạch
            với cơ quan thuế.
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════
          Month selector card
      ════════════════════════════════════════ */}
      <div className="
        overflow-hidden rounded-2xl border border-slate-200 bg-white
        shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08),_0_1px_4px_rgba(15,23,42,0.04)]
      ">
        {/* Card header strip */}
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Chọn tháng cần chốt sổ
          </p>
        </div>

        <div className="px-5 py-5">

          {/* ── Year selector — compact, centered ── */}
          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <button
                type="button"
                onClick={() => setCloseBookYear(y => y - 1)}
                aria-label="Năm trước"
                className="
                  flex h-7 w-7 items-center justify-center rounded-lg
                  text-slate-500 transition-all duration-150
                  hover:bg-white hover:text-slate-800 hover:shadow-sm
                  active:scale-95
                "
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>

              <span className="w-12 text-center text-sm font-bold tabular-nums text-slate-800">
                {closeBookYear}
              </span>

              <button
                type="button"
                onClick={() => setCloseBookYear(y => y + 1)}
                aria-label="Năm sau"
                className="
                  flex h-7 w-7 items-center justify-center rounded-lg
                  text-slate-500 transition-all duration-150
                  hover:bg-white hover:text-slate-800 hover:shadow-sm
                  active:scale-95
                "
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* ── Month grid ── */}
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((m) => {
              const closed   = isPeriodClosed(m, closeBookYear)
              const selected = m === closeBookMonth

              return (
                <button
                  key={m}
                  type="button"
                  disabled={closed || submitting}
                  onClick={() => setCloseBookMonth(m)}
                  className={`
                    relative py-3 rounded-xl border text-sm font-semibold
                    transition-all duration-150 select-none active:scale-[0.96]
                    ${selected && !closed
                      ? 'bg-brand-600 border-brand-600 text-white shadow-[0_4px_12px_-2px_rgba(37,99,235,0.35)]'
                      : closed
                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50'
                    }
                  `}
                >
                  T{m}

                  {/* Locked indicator — tiny lock badge */}
                  {closed && (
                    <span className="
                      absolute -right-1 -top-1
                      flex h-4 w-4 items-center justify-center
                      rounded-full border border-white bg-slate-400
                    ">
                      <Lock size={8} strokeWidth={2.5} className="text-white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Selected month status ── */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {selectedIsClosed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                <Lock size={11} strokeWidth={2.5} />
                Tháng {closeBookMonth}/{closeBookYear} — đã chốt
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Tháng {closeBookMonth}/{closeBookYear} — chưa chốt
              </span>
            )}
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════
          Already-closed periods summary
      ════════════════════════════════════════ */}
      {closedPeriods.length > 0 && (
        <div className="mt-5">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Các kỳ đã chốt
          </p>
          <div className="flex flex-wrap gap-2">
            {closedPeriods.map((ym) => {
              const [y, mo] = ym.split('-')
              return (
                <span
                  key={ym}
                  className="
                    inline-flex items-center gap-1.5
                    rounded-full border border-slate-200 bg-slate-100
                    px-3 py-1 text-xs font-semibold text-slate-500
                  "
                >
                  <Lock size={10} strokeWidth={2.5} className="text-slate-400" />
                  T{mo}/{y}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          Action button
      ════════════════════════════════════════ */}
      <button
        type="button"
        onClick={handleCloseBook}
        disabled={submitting || selectedIsClosed}
        className={`
          mt-6 flex min-h-[52px] w-full items-center justify-center gap-2.5
          rounded-xl text-sm font-bold tracking-wide
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-brand-300
          disabled:cursor-not-allowed
          ${selectedIsClosed
            ? 'bg-slate-100 text-slate-400 shadow-none'
            : submitting
            ? 'bg-brand-600 text-white opacity-70 shadow-none'
            : 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-[0_4px_16px_-2px_rgba(37,99,235,0.4)] hover:-translate-y-px hover:shadow-[0_6px_20px_-2px_rgba(37,99,235,0.5)] active:scale-[0.98]'
          }
        `}
      >
        {submitting ? (
          <>
            <Loader2 size={17} strokeWidth={2} className="animate-spin" />
            Đang chốt sổ...
          </>
        ) : selectedIsClosed ? (
          <>
            <CheckCircle2 size={17} strokeWidth={2} />
            Kỳ này đã được chốt
          </>
        ) : (
          <>
            <Lock size={16} strokeWidth={2.25} />
            Xác nhận chốt sổ
          </>
        )}
      </button>

      {/* Safety note under button */}
      {!selectedIsClosed && (
        <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
          Thao tác này không thể hoàn tác sau khi xác nhận
        </p>
      )}

    </div>
  )
}
