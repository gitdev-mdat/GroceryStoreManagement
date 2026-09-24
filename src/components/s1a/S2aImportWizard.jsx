import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, Trash2, AlertCircle,
  Loader2, CheckCircle2, FileX2, ChevronDown, ChevronUp,
  Calendar, Coins, Layers, Eye,
} from 'lucide-react'
import { extractPdfText } from '../../utils/pdfTextExtractor'
import { parseS2aPdf } from '../../utils/s2aPdfParser'
import { aggregateDaily, formatVnd } from '../../utils/s2aDailyAggregator'

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

const STEP = {
  SELECT_FILES:       'SELECT_FILES',
  ANALYZING:          'ANALYZING',
  EXTRACTION_RESULT:  'EXTRACTION_RESULT',
  PARSING:            'PARSING',
  DAILY_PREVIEW:      'DAILY_PREVIEW',
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function getFileIdentity(file) {
  return `${file.name}__${file.size}__${file.lastModified}`
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function progressPct(currentPage, totalPages) {
  if (!totalPages) return 0
  return Math.min(Math.round((currentPage / totalPages) * 100), 100)
}

// ─────────────────────────────────────────
// ExtractionResultCard
// ─────────────────────────────────────────

function ExtractionResultCard({ result }) {
  const isOk = result.status === 'success'

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        isOk ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
      }`}>
        {isOk
          ? <CheckCircle2 size={18} strokeWidth={2} />
          : <FileX2 size={18} strokeWidth={2} />
        }
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <span className="truncate text-sm font-medium text-slate-800" title={result.fileName}>
          {result.fileName}
        </span>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
          <span>{formatFileSize(result.fileSize)}</span>
          <span className="text-slate-300">·</span>
          <span>{result.pageCount} trang</span>
          {isOk && (
            <>
              <span className="text-slate-300">·</span>
              <span>{result.totalTextItems} mục văn bản</span>
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-600">
                Đã đọc nội dung PDF
              </span>
            </>
          )}
          {!isOk && (
            <>
              <span className="text-slate-300">·</span>
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 font-medium text-red-600">
                Không đọc được
              </span>
              <span className="mt-0.5 w-full text-red-400">{result.error?.message}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// DailyPreviewCard
// ─────────────────────────────────────────

function DailyPreviewCard({ day }) {
  const [expanded, setExpanded] = useState(false)
  const hasGroups = day.groupBreakdown.length > 1
  const isReady = day.status === 'ready'

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Card header */}
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
        onClick={() => hasGroups && setExpanded(e => !e)}
      >
        {/* Status icon */}
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          isReady ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
        }`}>
          {isReady
            ? <CheckCircle2 size={14} strokeWidth={2} />
            : <AlertCircle size={14} strokeWidth={2} />
          }
        </div>

        {/* Date */}
        <div className="w-24 shrink-0">
          <span className="text-sm font-semibold text-slate-800 leading-tight block">{day.displayDate}</span>
        </div>

        {/* Amount */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-slate-900 leading-tight block truncate">
            {formatVnd(day.totalAmount)} đ
          </span>
        </div>

        {/* Source rows + status badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 tabular-nums">{day.sourceRowCount} giao dịch</span>
          <span className={`
            inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium
            ${isReady
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
            }
          `}>
            {isReady
              ? <><CheckCircle2 size={10} strokeWidth={2.5} />Sẵn sàng</>
              : <><AlertCircle size={10} strokeWidth={2.5} />Cần xác nhận</>
            }
          </span>
        </div>

        {/* Expand chevron */}
        {hasGroups && (
          <div className={`
            shrink-0 text-slate-400 transition-transform duration-200
            flex items-center justify-center w-6 h-6 rounded-md
            hover:bg-slate-100 hover:text-slate-600
            ${expanded ? 'rotate-180' : ''}
          `}>
            <ChevronDown size={15} />
          </div>
        )}
      </button>

      {/* Expanded group breakdown */}
      {expanded && hasGroups && (
        <div className="border-t border-slate-100 px-3 py-2.5 space-y-1.5 bg-slate-50">
          {day.groupBreakdown.map(group => (
            <div key={group.groupCode} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{group.groupName}</span>
              <span className="text-xs font-medium text-slate-700">
                {formatVnd(group.amount)} đ
              </span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-1.5 mt-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Tổng</span>
            <span className="text-xs font-bold text-slate-800">
              {formatVnd(day.totalAmount)} đ
            </span>
          </div>
        </div>
      )}

      {/* Warnings */}
      {day.warnings && day.warnings.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-2 bg-amber-50">
          {day.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────

export default function S2aImportWizard({ onBack }) {
  const [step, setStep] = useState(STEP.SELECT_FILES)

  // State shape (approved):
  //   files           — raw File objects selected by the user
  //   parsedFiles     — populated when PDF extraction is implemented
  //   months          — populated when PDF extraction is implemented
  //   days            — populated when PDF extraction is implemented
  //   reconciliation  — null or { conflicts: [], skipped: [] }
  //   importResult    — null or { importedCount, errors }
  //   error           — null or { message }
  const [files, setFiles] = useState([])
  const [parsedFiles, setParsedFiles] = useState([])
  const [months, setMonths] = useState([])
  const [days, setDays] = useState([])
  const [reconciliation, setReconciliation] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [error, setError] = useState(null)

  const [isDragOver, setIsDragOver] = useState(false)
  const [notification, setNotification] = useState(null)

  // Extraction state
  const [analyzingProgress, setAnalyzingProgress] = useState(null)
  // { currentFileIndex, totalFiles, currentFileName, currentPage, totalPages }
  const [extractionResults, setExtractionResults] = useState([])
  const cancelledRef = useRef(false)

  // Parsing state
  const [parsingProgress, setParsingProgress] = useState(null)
  // { currentFileIndex, totalFiles, currentFileName }
  const [aggregationResult, setAggregationResult] = useState(null)
  // result from aggregateDaily()

  const inputRef = useRef(null)

  // ── Navigation ────────────────────────────────────────

  const reset = useCallback(() => {
    setStep(STEP.SELECT_FILES)
    setFiles([])
    setParsedFiles([])
    setMonths([])
    setDays([])
    setReconciliation(null)
    setImportResult(null)
    setError(null)
    setAnalyzingProgress(null)
    setExtractionResults([])
    setParsingProgress(null)
    setAggregationResult(null)
    setNotification(null)
    cancelledRef.current = false
  }, [])

  // ── Helpers ──────────────────────────────────────────

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }, [])

  const addFiles = useCallback((incoming) => {
    const valid = []
    const errors = []

    for (const file of incoming) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext !== 'pdf') {
        errors.push(`"${file.name}" — Chỉ hỗ trợ tệp PDF sổ S2A-HKD.`)
        continue
      }
      if (file.type !== 'application/pdf') {
        errors.push(`"${file.name}" — Chỉ hỗ trợ tệp PDF sổ S2A-HKD.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" — Tệp vượt quá dung lượng cho phép 20 MB.`)
        continue
      }
      valid.push(file)
    }

    if (errors.length > 0) showNotification(errors.join(' '), 'error')
    if (valid.length === 0) return

    const existing = new Set(files.map(getFileIdentity))
    const notDupes = valid.filter(f => {
      if (existing.has(getFileIdentity(f))) {
        showNotification(`"${f.name}" — Tệp này đã được chọn.`, 'warning')
        return false
      }
      return true
    })

    if (notDupes.length > 0) setFiles(prev => [...prev, ...notDupes])
  }, [files, showNotification])

  const removeFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleClearAll = () => {
    if (files.length > 1) {
      if (!window.confirm('Xóa tất cả các tệp đã chọn?')) return
    }
    setFiles([])
  }

  // ── Event handlers ────────────────────────────────────

  const handleInputChange = (e) => {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true) }
  const handleDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget)) return
    setIsDragOver(false)
  }
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation() }
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation()
    setIsDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length) addFiles(dropped)
  }

  // ── Extraction ────────────────────────────────────────

  const handleAnalyze = async () => {
    if (files.length === 0) return

    cancelledRef.current = false
    setAnalyzingProgress({ currentFileIndex: 0, totalFiles: files.length, currentFileName: files[0].name, currentPage: 0, totalPages: null })
    setExtractionResults([])
    setStep(STEP.ANALYZING)

    const results = []

    for (let i = 0; i < files.length; i++) {
      if (cancelledRef.current) break

      const file = files[i]

      setAnalyzingProgress({
        currentFileIndex: i,
        totalFiles: files.length,
        currentFileName: file.name,
        currentPage: 0,
        totalPages: null,
      })

      const fileIndexRef = i

      const result = await extractPdfText(file, {
        onProgress: (progress) => {
          if (cancelledRef.current) return
          setAnalyzingProgress(prev => prev && prev.currentFileIndex === fileIndexRef
            ? { ...prev, currentPage: progress.currentPage, totalPages: progress.totalPages }
            : prev
          )
        },
      })

      if (cancelledRef.current) break
      results.push(result)
    }

    if (!cancelledRef.current) {
      setExtractionResults(results)
      setStep(STEP.EXTRACTION_RESULT)
    }
    setAnalyzingProgress(null)
  }

  const handleCancel = () => {
    cancelledRef.current = true
    setAnalyzingProgress(null)
    setParsingProgress(null)
    setStep(STEP.SELECT_FILES)
  }

  // ── Parsing ──────────────────────────────────────────

  const handleContinueToParsing = async () => {
    const successful = extractionResults.filter(r => r.status === 'success')
    if (successful.length === 0) {
      showNotification('Không có file nào đọc thành công để phân tích.', 'error')
      return
    }

    setStep(STEP.PARSING)
    setParsingProgress({ currentFileIndex: 0, totalFiles: successful.length, currentFileName: successful[0].name })

    // Parse each successfully extracted file
    const parsedResults = []
    for (let i = 0; i < successful.length; i++) {
      if (cancelledRef.current) break

      const result = successful[i]
      setParsingProgress({
        currentFileIndex: i,
        totalFiles: successful.length,
        currentFileName: result.fileName,
      })

      let parsed
      try {
        parsed = parseS2aPdf(result)
      } catch (err) {
        // Catch parser exceptions so the UI never hangs in PARSING
        if (import.meta.env.DEV) {
          console.error('[DEV] parseS2aPdf threw:', err)
        }
        showNotification(
          'Không thể phân tích dữ liệu trong file PDF. Vui lòng thử lại.',
          'error'
        )
        setParsingProgress(null)
        setStep(STEP.EXTRACTION_RESULT)
        return
      }
      parsedResults.push(parsed)

      // ── DEV CHECKPOINT: parser-output ───────────────────────
      if (import.meta.env.DEV) {
        console.log('[DEV] checkpoint: parser-output', {
          file: result.fileName,
          status: parsed.status,
          rows: parsed.rows.length,
          diagnostics: parsed.diagnostics,
          firstRow: parsed.rows[0] || null,
        })
      }
    }

    if (cancelledRef.current) {
      setParsingProgress(null)
      setStep(STEP.SELECT_FILES)
      return
    }

    // Aggregate
    setParsingProgress({ currentFileIndex: successful.length, totalFiles: successful.length, currentFileName: 'Tổng hợp...' })
    const agg = aggregateDaily(parsedResults)

    // ── DEV CHECKPOINT: aggregation-output ─────────────────
    if (import.meta.env.DEV) {
      console.log('[DEV] checkpoint: aggregation-output', {
        status: agg.status,
        uniqueDates: agg.uniqueDates,
        grandTotal: agg.reconciliation.grandTotalBefore,
        totalsMatch: agg.reconciliation.totalsMatch,
        validRows: agg.validRows,
        needsReviewRows: agg.needsReviewRows,
        errorMessage: agg.errorMessage,
      })
    }

    setAggregationResult(agg)
    setParsingProgress(null)

    if (agg.status === 'error') {
      setError({ message: agg.errorMessage || 'Lỗi khi tổng hợp dữ liệu.' })
      setStep(STEP.EXTRACTION_RESULT)
    } else {
      setDays(agg.days)
      setReconciliation(agg.reconciliation)
      setStep(STEP.DAILY_PREVIEW)
    }
  }

  // ── Derived ───────────────────────────────────────────

  const hasFiles = files.length > 0
  const hasSuccessfulExtractions = extractionResults.some(r => r.status === 'success')

  const resultStats = {
    total: extractionResults.length,
    success: extractionResults.filter(r => r.status === 'success').length,
    failed: extractionResults.filter(r => r.status === 'error').length,
  }

  // ── Render ────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-[640px] px-0 sm:px-4">
      {/* Page Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={step === STEP.SELECT_FILES ? onBack : undefined}
          disabled={step === STEP.ANALYZING || step === STEP.PARSING}
          className={`
            flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors
            ${step === STEP.ANALYZING || step === STEP.PARSING
              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
              : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2'
            }
          `}
          aria-label="Quay lại"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Nhập dữ liệu lịch sử
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Chuyển dữ liệu từ sổ S2A cũ sang S1A
          </p>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            notification.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : notification.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-brand-200 bg-brand-50 text-brand-700'
          }`}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* ── SELECT_FILES ─────────────────────────────── */}

      {step === STEP.SELECT_FILES && (
        <>
          {/* Introduction */}
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              Ứng dụng sẽ đọc các file sổ S2A cũ và tổng hợp thành doanh thu theo ngày trong S1A.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              File gốc của bạn không bị thay đổi.
            </p>
          </div>

          {/* Upload area */}
          <div
            className={`
              relative mb-5 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed
              p-8 text-center transition-all duration-200 cursor-pointer select-none
              ${isDragOver
                ? 'border-brand-400 bg-brand-50'
                : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'
              }
            `}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Chọn tệp PDF để nhập"
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              onChange={handleInputChange}
              aria-hidden="true"
              tabIndex={-1}
            />

            <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${isDragOver ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>
              <Upload size={22} strokeWidth={1.75} />
            </div>

            <p className="text-sm font-semibold text-slate-700">Chọn tệp PDF</p>
            <p className="mt-1 text-xs text-slate-400">
              Bạn cũng có thể kéo thả tệp vào đây khi dùng máy tính.
            </p>
          </div>

          {/* Selected files list */}
          {files.length > 0 && (
            <div className="mb-5 space-y-2.5">
              {files.map((file, index) => (
                <div
                  key={getFileIdentity(file)}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <span className="truncate text-sm font-medium text-slate-800" title={file.name}>
                      {file.name}
                    </span>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                      <span>{formatFileSize(file.size)}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-amber-600">Chưa phân tích</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1"
                    aria-label={`Xóa tệp ${file.name}`}
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* List actions */}
          {files.length > 0 && (
            <div className="mb-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Thêm tệp khác
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2"
              >
                <Trash2 size={16} strokeWidth={2} />
                Xóa tất cả
              </button>
            </div>
          )}

          {/* Primary action */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              disabled={!hasFiles}
              onClick={hasFiles ? handleAnalyze : undefined}
              className={`
                relative flex w-full flex-col items-center gap-1.5 rounded-xl py-3.5 text-white shadow-sm transition-all
                ${hasFiles
                  ? 'bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2'
                  : 'bg-brand-600 opacity-60 cursor-not-allowed'
                }
              `}
              aria-disabled={!hasFiles}
            >
              <span className="text-sm font-semibold">Phân tích dữ liệu</span>
              <span className="text-xs text-brand-200">
                {files.length} tệp PDF
              </span>
            </button>
          </div>
        </>
      )}

      {/* ── ANALYZING ───────────────────────────────── */}

      {step === STEP.ANALYZING && analyzingProgress && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          {/* Spinner + file name */}
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Loader2 size={26} className="animate-spin" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Đang đọc {analyzingProgress.currentFileName}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Tệp {analyzingProgress.currentFileIndex + 1} / {analyzingProgress.totalFiles}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          {analyzingProgress.totalPages > 0 && (
            <div className="mb-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Trang {analyzingProgress.currentPage} / {analyzingProgress.totalPages}</span>
                <span>{progressPct(analyzingProgress.currentPage, analyzingProgress.totalPages)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${progressPct(analyzingProgress.currentPage, analyzingProgress.totalPages)}%` }}
                />
              </div>
            </div>
          )}

          {analyzingProgress.totalPages == null && (
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-500 animate-pulse" style={{ width: '60%' }} />
            </div>
          )}

          {/* Privacy note */}
          <p className="mt-4 text-center text-xs text-slate-400">
            Tệp được đọc trực tiếp trên thiết bị và không được tải lên máy chủ.
          </p>

          {/* Cancel */}
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* ── EXTRACTION_RESULT ─────────────────────── */}

      {step === STEP.EXTRACTION_RESULT && (
        <>
          {/* Error banner */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error.message}</span>
            </div>
          )}

          {/* Summary */}
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              Đã đọc {resultStats.total} tệp PDF.
              {' '}<span className="font-semibold text-emerald-600">{resultStats.success}</span> thành công
              {resultStats.failed > 0 && (
                <span className="ml-1 text-red-500">· {resultStats.failed} thất bại</span>
              )}
            </p>
          </div>

          {/* Result cards */}
          <div className="mb-5 space-y-2.5">
            {extractionResults.map((result) => (
              <ExtractionResultCard key={result.fileId} result={result} />
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleAnalyze}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Chọn lại tệp
            </button>

            <button
              type="button"
              disabled={!hasSuccessfulExtractions}
              onClick={hasSuccessfulExtractions ? handleContinueToParsing : undefined}
              className={`
                relative flex w-full flex-col items-center gap-1.5 rounded-xl py-3.5 text-white shadow-sm transition-all
                ${hasSuccessfulExtractions
                  ? 'bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2'
                  : 'bg-brand-600 opacity-60 cursor-not-allowed'
                }
              `}
              aria-disabled={!hasSuccessfulExtractions}
            >
              <span className="text-sm font-semibold">Tiếp tục phân tích nội dung</span>
              <span className="text-xs text-brand-200">
                {resultStats.success} tệp PDF sẵn sàng
              </span>
            </button>

            <p className="mt-1 text-center text-xs text-slate-400">
              Bước tiếp theo sẽ nhận diện ngày và doanh thu trong các file đã đọc.
            </p>
          </div>

          {/* Reset */}
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={reset}
              className="text-xs text-slate-400 underline hover:text-slate-600"
            >
              Bắt đầu lại
            </button>
          </div>
        </>
      )}

      {/* ── PARSING ────────────────────────────────── */}

      {step === STEP.PARSING && parsingProgress && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Loader2 size={26} className="animate-spin" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Đang nhận diện ngày và doanh thu
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {parsingProgress.currentFileIndex < parsingProgress.totalFiles
                  ? `Tệp ${parsingProgress.currentFileIndex + 1} / ${parsingProgress.totalFiles}: ${parsingProgress.currentFileName}`
                  : 'Đang tổng hợp dữ liệu...'
                }
              </p>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            Tệp được đọc trực tiếp trên thiết bị và không được tải lên máy chủ.
          </p>
        </div>
      )}

      {/* ── DAILY_PREVIEW ─────────────────────────── */}

      {step === STEP.DAILY_PREVIEW && aggregationResult && (
        <>
          {/* ── Hero Summary ──────────────────────────────────── */}
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
            {/* Status row */}
            <div className="flex items-center gap-1.5 mb-3">
              <CheckCircle2 size={16} className="text-emerald-600" strokeWidth={2} />
              <p className="text-sm font-semibold text-emerald-700">Đã nhận diện thành công</p>
            </div>

            {/* Grand total — dominant visual */}
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
              {formatVnd(aggregationResult.reconciliation.grandTotalBefore)}
              <span className="ml-1 text-lg font-semibold text-slate-400">đ</span>
            </p>
            <p className="text-xs text-slate-400 mb-4">Tổng doanh thu</p>

            {/* Meta row */}
            <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-emerald-100 pt-3">
              <span>{aggregationResult.uniqueDates} ngày ghi nhận</span>
              <span className="text-slate-200">·</span>
              <span>{aggregationResult.totalSourceRows} giao dịch nguồn</span>
              <span className="text-slate-200">·</span>
              <span className={`font-medium ${aggregationResult.reconciliation.totalsMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                {aggregationResult.reconciliation.totalsMatch ? 'Đối soát thành công' : 'Chênh lệch'}
              </span>
            </div>
          </div>

          {/* ── Group breakdown badges ─────────────────────────── */}
          <div className="mb-4 space-y-1.5">
            {[
              { code: 'hmpt', label: 'Hóa mỹ phẩm', icon: '🧴' },
              { code: 'ddgd', label: 'Gia dụng & Tiện ích', icon: '🏠' },
              { code: 'tpdg', label: 'Thực phẩm đóng gói', icon: '🥤' },
              { code: 'tpts', label: 'Hàng hóa tươi sống', icon: '🥬' },
            ].map(({ code, label, icon }) => {
              const amount = aggregationResult.reconciliation.groupTotals[code]?.parsed || 0
              return (
                <div key={code} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm" role="img" aria-hidden="true">{icon}</span>
                    <span className="text-xs font-medium text-slate-600">{label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{formatVnd(amount)} đ</span>
                </div>
              )
            })}
          </div>

          {/* ── Reconciliation / needs-review warnings ─────────── */}
          {!aggregationResult.reconciliation.totalsMatch && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                Tổng không khớp: trước {formatVnd(aggregationResult.reconciliation.grandTotalBefore)} đ,
                sau {formatVnd(aggregationResult.reconciliation.grandTotalAfter)} đ
              </span>
            </div>
          )}
          {aggregationResult.needsReviewRows > 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-600 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{aggregationResult.needsReviewRows} dòng cần xác nhận — không được thêm vào tổng doanh thu.</span>
            </div>
          )}

          {/* ── Needs review rows ───────────────────────────────── */}
          {aggregationResult.needsReviewRows > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                <AlertCircle size={14} />
                Dòng cần xác nhận ({aggregationResult.needsReviewRows})
              </p>
            </div>
          )}

          {/* ── Daily cards ─────────────────────────────────────── */}
          <div className="mb-4 space-y-1.5">
            {days.map(day => (
              <DailyPreviewCard key={day.saleDate} day={day} />
            ))}
          </div>

          {/* ── Actions ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <button
              type="button"
              disabled
              className="relative flex w-full flex-col items-center gap-1 rounded-xl py-3 text-white shadow-sm opacity-60 cursor-not-allowed"
              aria-disabled="true"
            >
              <span className="text-sm font-semibold">Kiểm tra dữ liệu hiện có</span>
              <span className="text-xs text-brand-200">
                Bước tiếp theo sẽ kiểm tra ngày trùng và kỳ đã chốt.
              </span>
            </button>

            <button
              type="button"
              onClick={handleAnalyze}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Chọn lại tệp
            </button>
          </div>

          {/* Reset */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={reset}
              className="text-xs text-slate-400 underline hover:text-slate-600"
            >
              Bắt đầu lại
            </button>
          </div>
        </>
      )}
    </div>
  )
}
