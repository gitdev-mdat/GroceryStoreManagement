import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { formatVnd, roundToThousands, formatVndInputDisplay, parseVndInput } from '../FormatNumber'
import DatePicker from '../DatePicker'
import {
  ArrowLeft,
  TrendingUp,
  X,
  Check,
  AlertCircle,
  Loader2,
  Save
} from 'lucide-react'

export default function AddTicketForm({ onBack, onNotify, onRefresh }) {
  const { isPeriodClosed } = useApp()

  const now = new Date()
  const [date, setDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  )
  const [amountRaw, setAmountRaw] = useState('')
  const [amountDisplay, setAmountDisplay] = useState('')
  
  // Create or Edit state
  const [existingId, setExistingId] = useState(null)
  const [isDirty, setIsDirty] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const formatVietnameseDate = (isoDate) => {
    if (!isoDate) return ''
    const [y, m, d] = isoDate.split('-')
    return `${d}/${m}/${y}`
  }

  const autoNotes = `Doanh thu bán lẻ tạp hóa ngày ${formatVietnameseDate(date)} theo bảng kê ngày ${formatVietnameseDate(date)}`

  useEffect(() => {
    async function checkExisting() {
      if (!isSupabaseConfigured() || !date) return
      try {
        const { data, error } = await supabase
          .from('sales_tickets')
          .select('*')
          .eq('sale_date', date)
          .maybeSingle()

        if (error) {
          console.error('Lỗi kiểm tra ngày:', error)
          return
        }
        
        if (data) {
          setExistingId(data.id)
          const amtStr = String(data.total_amount || 0)
          setAmountRaw(amtStr)
          setAmountDisplay(formatVndInputDisplay(amtStr))
          setErrors({})
          setIsDirty(false)
        } else {
          setExistingId(null)
          setAmountRaw('')
          setAmountDisplay('')
          setIsDirty(false)
        }
      } catch (err) {
        console.error('Lỗi kiểm tra ngày:', err)
      }
    }
    checkExisting()
  }, [date])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }

  const handleAmountChange = (e) => {
    setIsDirty(true)
    const raw = e.target.value.replace(/\D/g, '')
    setAmountRaw(raw)
    setAmountDisplay(formatVndInputDisplay(raw))
    if (errors.amount) setErrors(prev => ({ ...prev, amount: null }))
  }

  const handleAmountFocus = () => {
    if (amountRaw) setAmountDisplay(amountRaw)
  }

  const handleAmountBlur = () => {
    if (amountRaw && Number(amountRaw) > 0) {
      setAmountDisplay(formatVndInputDisplay(amountRaw))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amount = parseVndInput(amountRaw)
    const newErrors = {}

    if (!amountRaw || amount <= 0) newErrors.amount = 'Vui lòng nhập số tiền doanh thu'
    if (!date) newErrors.date = 'Vui lòng chọn ngày'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    if (isPeriodClosed?.(date)) {
      showToast('Kỳ này đã chốt sổ, không thể lưu.', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (!isSupabaseConfigured()) throw new Error('Chưa kết nối Supabase')

      if (existingId) {
        // UPDATE
        const { error } = await supabase
          .from('sales_tickets')
          .update({
            total_amount: Number(roundToThousands(amount)),
            notes: autoNotes,
          })
          .eq('id', existingId)
        if (error) throw error
        showToast(`Đã cập nhật doanh thu: ${formatVnd(amount)} VND.`)
      } else {
        // INSERT
        const { error } = await supabase
          .from('sales_tickets')
          .insert([{
            sale_date: date,
            total_amount: Number(roundToThousands(amount)),
            notes: autoNotes,
          }])
        if (error) throw error
        showToast(`Đã ghi nhận doanh thu: ${formatVnd(amount)} VND.`)
      }

      setSubmitSuccess(true)
      setIsDirty(false)
      onRefresh?.()
      setTimeout(() => onBack?.(), 1800)
    } catch (err) {
      console.error('Lỗi lưu doanh thu:', err)
      showToast(err.message || 'Không thể lưu doanh thu.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const parsedAmount = parseVndInput(amountRaw)
  const hasValidAmount = amountDisplay && Number(amountRaw) > 0

  return (
    <>
      <div className="mx-auto w-full max-w-[640px] px-0 pb-16 sm:pb-24">

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
              Ghi nhận doanh thu
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Nhập doanh thu bán lẻ cho một ngày cụ thể
            </p>
          </div>
        </div>

        {existingId && (
          <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 border border-blue-100 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-blue-500" strokeWidth={2.25} />
            <p>Ngày {formatVietnameseDate(date)} đã ghi nhận doanh thu. Bạn có thể chỉnh sửa số tiền.</p>
          </div>
        )}

        <div className="
          overflow-hidden rounded-2xl border border-slate-200 bg-white
          shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08),_0_1px_4px_rgba(15,23,42,0.04)]
        ">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Thông tin doanh thu
            </p>
          </div>

          <form onSubmit={handleSubmit} id="ticket-form" className="px-4 py-5 sm:px-6 sm:py-6">
            
            <div className="mb-5 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ngày ghi nhận
              </label>
              <div className={`
                flex items-center overflow-hidden rounded-xl border bg-slate-50 transition-all duration-150
                focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100
                ${errors.date
                  ? 'border-red-300 bg-red-50/50 ring-2 ring-red-100'
                  : 'border-slate-200 hover:border-slate-300'
                }
              `}>
                <DatePicker
                  value={date}
                  onChange={(val) => {
                    if (val === date) return
                    if (isDirty) {
                      if (!window.confirm("Bạn có dữ liệu chưa lưu. Đổi ngày sẽ làm mất dữ liệu này. Tiếp tục?")) {
                        return
                      }
                    }
                    setDate(val)
                    if (errors.date) setErrors(prev => ({ ...prev, date: null }))
                  }}
                  aria-label="Chọn ngày"
                  className="!flex-1 !bg-transparent !border-0 !shadow-none !rounded-none !text-sm !font-medium !text-slate-800 !px-3 !py-2.5"
                  disabled={isPeriodClosed?.(date)}
                />
              </div>
              {errors.date && (
                <p className="flex items-center gap-1 text-xs font-medium text-red-500">
                  <AlertCircle size={11} strokeWidth={2.5} />
                  {errors.date}
                </p>
              )}
            </div>

            <div className="mb-5">
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

            <div className="mb-8">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Diễn giải
              </label>
              <div className="w-full resize-none rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-3 text-sm leading-relaxed text-slate-600 cursor-not-allowed">
                {autoNotes}
              </div>
            </div>

            <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

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
                    {existingId ? 'Đang cập nhật...' : 'Đang lưu...'}
                  </>
                ) : submitSuccess ? (
                  <>
                    <Check size={16} strokeWidth={2.5} />
                    {existingId ? 'Đã cập nhật!' : 'Đã lưu!'}
                  </>
                ) : (
                  <>
                    <Save size={16} strokeWidth={2.5} />
                    {existingId ? 'Cập nhật doanh thu' : 'Lưu doanh thu'}
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
          Dữ liệu lưu vào Sổ S1A-HKD theo Thông tư 152/2025/TT-BTC
        </p>
      </div>

      {toast && (
        <div
          className={`
            fixed left-1/2 top-6 z-[100] flex -translate-x-1/2 items-center gap-2.5
            whitespace-nowrap rounded-2xl px-4 py-3
            shadow-[0_8px_32px_-4px_rgba(15,23,42,0.2)]
            backdrop-blur-md
            ${toast.type === 'success'
              ? 'border border-slate-200/80 bg-white/95 text-slate-800'
              : 'border border-red-200 bg-red-50/95 text-red-800'
            }
          `}
          style={{ animation: 'atf-toast-drop 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <div className={`
            flex h-6 w-6 shrink-0 items-center justify-center rounded-full
            ${toast.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}
          `}>
            {toast.type === 'success'
              ? <Check size={13} strokeWidth={2.5} className="text-emerald-600" />
              : <AlertCircle size={13} strokeWidth={2.5} className="text-red-600" />
            }
          </div>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      <style>{`
        @keyframes atf-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes atf-sheet-up {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes atf-toast-drop {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.94); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
