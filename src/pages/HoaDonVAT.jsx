import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { VAT_IMAGE_MAX_SIZE } from '../data/constants'
import { formatVndExact } from '../components/FormatNumber'
import VndInput from '../components/VndInput'
import { formatDateForInput, formatDateDisplay } from '../components/FormatDate'
import DatePicker from '../components/DatePicker'
import { GoogleGenAI } from '@google/genai'
import { resizeAndCompressImage } from '../utils/imageHelper'
import { formatToInputDate } from '../utils/dateHelper'
import { saveToProductPriceBook } from '../utils/priceHelper'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import { abbreviationDictionary } from '../utils/abbreviationDictionary'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_TIMEOUT_MS = 60_000
// ── Error Sanitizer: biến lỗi kỹ thuật thành thông báo tiếng Việt thân thiện ────────────
function sanitizeErrorMessage(err) {
  const raw = String(err?.message || err || '')
  // 401 / UNAUTHENTICATED — key sai hoặc hết hạn
  if (/401|UNAUTHENTICATED|api.?key|invalid.?key/i.test(raw)) {
    return 'Lỗi kết nối máy chủ OCR (Mã: 401). Vui lòng kiểm tra lại cấu hình tài khoản hoặc thử lại sau.'
  }
  // 403 Forbidden
  if (/403|PERMISSION_DENIED|forbidden/i.test(raw)) {
    return 'Không có quyền truy cập dịch vụ OCR (Mã: 403). Vui lòng kiểm tra API Key.'
  }
  // 429 / Rate limit
  if (/429|RATE_LIMIT|Too Many Requests/i.test(raw)) {
    return 'Hệ thống Gemini đang quá tải (Mã: 429). Vui lòng đợi vài giây và thử lại.'
  }
  // 503 / Overload
  if (/503|UNAVAILABLE|overloaded|high demand|busy/i.test(raw)) {
    return 'Máy chủ Gemini đang bận (Mã: 503). Hệ thống đang tự động thử lại...'
  }
  // Abort / timeout
  if (/abort|timeout|Quét OCR bị gián đoạn/i.test(raw)) {
    return 'Quét OCR bị gián đoạn do quá thời gian. Vui lòng thử lại.'
  }
  // JSON / parse errors — thường xuất hiện khi AI trả về kết quả lạ
  if (/JSON|parse|SyntaxError/i.test(raw)) {
    return 'Đọc kết quả OCR không thành công. Vui lòng thử lại hoặc nhập tay.'
  }
  // Nếu message ngắn và hợp lý (tiếng Việt thân thiện, không có JSON), giữ nguyên
  if (raw.length < 120 && !/\{|\[|http|\.com|Error:/i.test(raw)) {
    return raw
  }
  // Fallback cho mọi lỗi kỹ thuật khác
  return 'Đã xảy ra lỗi khi quét hóa đơn. Vui lòng thử lại.'
}

// ── Floating Toast Component ──────────────────────────────────────────────────
function FloatingToast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDismiss, 6000)
    return () => clearTimeout(timer)
  }, [message, onDismiss])
  if (!message) return null
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{ zIndex: 9999 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md
        bg-red-600 text-white rounded-xl shadow-2xl px-4 py-3
        flex items-center gap-3"
    >
      <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
      <p className="text-sm font-semibold leading-snug flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
        aria-label="Đóng thông báo"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
// ── Auto-compress image to JPEG < 500KB using Canvas ─────────────────────────
// Không bao giờ reject file — luôn compress đến khi đủ nhỏ
async function compressToDataUrl(file, targetBytes = 500 * 1024) {
  // Nếu file đã đủ nhỏ và là ảnh JPEG/PNG, chuyển thẳng
  if (file.size <= targetBytes && (file.type === 'image/jpeg' || file.type === 'image/png')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Không đọc được file.'))
      reader.readAsDataURL(file)
    })
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        // Bắt đầu với kích thước gốc, giảm dần nếu vẫn quá lớn
        let maxDim = 1600
        let quality = 0.82
        const tryCompress = () => {
          const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1)
          const w = Math.round(img.width * ratio)
          const h = Math.round(img.height * ratio)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          // Ước lượng kích thước bytes của base64 string
          const estimatedBytes = Math.round((dataUrl.length * 3) / 4)
          if (estimatedBytes > targetBytes && (quality > 0.45 || maxDim > 600)) {
            // Giảm quality 10% hoặc kích thước 80% mỗi vòng lặp
            if (quality > 0.50) {
              quality = Math.max(0.45, quality - 0.10)
            } else {
              maxDim = Math.max(600, Math.round(maxDim * 0.80))
              quality = 0.70 // reset quality khi giảm kích thước
            }
            tryCompress()
          } else {
            resolve(dataUrl)
          }
        }
        tryCompress()
      } catch (err) {
        reject(err)
      }
    }
  })
}

async function fileToGenerativePart(file) {
  const compressed = await resizeAndCompressImage(file)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      try {
        const base64 = String(reader.result).split(',')[1]
        resolve({
          inlineData: {
            data: base64,
            mimeType: 'image/jpeg',
          },
        })
      } catch (err) {
        reject(new Error('Không chuyển được ảnh sang dạng xử lý OCR.'))
      }
    }
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'))
    reader.readAsDataURL(compressed)
  })
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const MAX_RETRIES = 3

// Chuyển chuỗi base64 data URL thành Blob để upload Storage
function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) return null
  const mimeType = matches[1]
  const base64Data = matches[2]
  const byteChars = atob(base64Data)
  const byteArray = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i)
  }
  return new Blob([byteArray], { type: mimeType })
}

const OCR_STATUS_TEXTS = [
  'Đang nén ảnh...',
  'Đang gửi hóa đơn cho Gemini...',
  'Gemini đang bóc tách sản phẩm...',
  'Đang tính toán biến động giá...',
]

function getOcrStatusText(attempt, stage) {
  if (stage === 'retry') {
    return `Hệ thống đang bận, đang tự động thử lại lần ${attempt}/${MAX_RETRIES}...`
  }
  if (stage === 'fallback') {
    return '🤖 Hệ thống bận, đang chuyển sang bộ não dự phòng để quét lại hóa đơn...'
  }
  const idx = Math.max(0, Math.min(OCR_STATUS_TEXTS.length - 1, attempt - 1))
  return OCR_STATUS_TEXTS[idx]
}

const PROMO_KEYWORDS = /\b(KM|K\.?M\.?|CK|KHUYEN MAI|CHIET KHAU|QUA TANG|TANG)\b/i

function isPromoRow(item = {}) {
  const name = String(item.item_name || item.ten_hang || '').trim()
  const price = Number(item.unit_price_after_vat ?? item.don_gia_sau_vat ?? item.unit_price_before_vat ?? item.don_gia_truoc_vat ?? 0)
  return PROMO_KEYWORDS.test(name) && price === 0
}

function isNonProductRow({ ten_hang = '', don_gia_sau_vat, don_gia_truoc_vat } = {}) {
  const name = String(ten_hang || '').trim().toUpperCase()
  if (!name) return true
  return false
}

function capitalizeProductName(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part, idx) => {
      if (!part) return part
      if (/^[A-Z0-9\.\-]+$/i.test(part) && part.length <= 12) return part.toUpperCase()
      const lower = part.toLowerCase()
      if (idx === 0) return lower.charAt(0).toUpperCase() + lower.slice(1)
      return lower
    })
    .join(' ')
}

// Chuẩn hóa Title Case: mỗi từ viết hoa chữ cái đầu (VD: "Bánh Mì Tươi Kinh Đô")
function toTitleCase(text) {
  if (!text) return ''
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function expandAbbreviations(text) {
  const upper = String(text || '').toUpperCase()
  let result = upper
  Object.entries(abbreviationDictionary)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([abbr, full]) => {
      const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), full)
    })
  return result
}

function normalizeProductName(raw) {
  if (!raw) return ''
  const expanded = expandAbbreviations(raw)
  return toTitleCase(expanded)
}

// Cập nhật một trường bất kỳ của dòng sản phẩm trong editableItems
// Khi sửa giá nhập → tự động recalculate giá bán tức thì
function handleProductFieldChange(index, field, rawValue) {
  setEditableItems((prev) => {
    const updated = [...prev]
    const item = { ...updated[index] }

    if (field === 'ten_hang') {
      item.ten_hang = toTitleCase(rawValue)
      item.item_name = toTitleCase(rawValue)
    } else if (field === 'don_vi_tinh') {
      item.don_vi_tinh = rawValue
      item.unit = rawValue
    } else if (field === 'don_gia_sau_vat') {
      // Parse giá: chuỗi "3.900" hoặc "3900" → number
      const numeric = parseVietnamesePrice(rawValue)
      item.don_gia_sau_vat = numeric
      item.unit_price_after_vat = numeric
      // Tự động recalculate giá bán tức thì bằng calculateSmartRetailPrice
      item._suggested_retail = calculateSmartRetailPrice(item)
    } else if (field === 'so_luong') {
      const qty = Number(rawValue) || 0
      item.so_luong = qty
      item.quantity = qty
    }

    updated[index] = item
    return updated
  })
}

function sanitizeOcrData(rawData) {
  if (!rawData) return null

  // Lớp bảo vệ: Khử chuỗi chữ "null" phát sinh từ AI thành dữ liệu trống thật
  const cleanString = (val) => {
    if (!val) return ''
    const trimmed = String(val).trim()
    if (trimmed.toLowerCase() === 'null' || trimmed === '—' || trimmed === '-' || trimmed === 'N/A') return ''
    return trimmed
  }

  // Làm sạch mảng hàng hóa
  const cleanItems = (items) => {
    if (!Array.isArray(items)) return []
    return items.map(item => {
      // Normalize row_type (English key mapping)
      const rawType = item.row_type || item.loai_dong || item.item_type
      let finalType = 'MUA'

      if (rawType) {
        finalType = String(rawType).trim().toUpperCase()
      } else if (Number(item.unit_price_after_vat || item.don_gia_sau_vat) === 0) {
        finalType = 'KM'
      }

      // Ép về MUA nếu giá trị không phải MUA hoặc KM
      if (finalType !== 'MUA' && finalType !== 'KM') {
        finalType = 'MUA'
      }

      return {
        ...item,
        item_name: cleanString(item.item_name || item.ten_hang),
        unit: cleanString(item.unit || item.don_vi_tinh),
        product_code: cleanString(item.product_code || item.ma_hang_goc),
        row_type: finalType,
        quantity: item.quantity || item.so_luong,
        unit_price_after_vat: item.unit_price_after_vat || item.don_gia_sau_vat,
      }
    })
  }

  return {
    ...rawData,
    invoice_type: rawData.invoice_type || 'VAT',
    invoice_info: {
      serial_number: cleanString(rawData.invoice_info?.serial_number || rawData.thong_tin_hoa_don?.ky_hieu),
      invoice_number: cleanString(rawData.invoice_info?.invoice_number || rawData.thong_tin_hoa_don?.so_hoa_don),
      issue_date: rawData.invoice_info?.issue_date || rawData.thong_tin_hoa_don?.ngay_xuat,
    },
    seller: {
      company_name: cleanString(rawData.seller?.company_name || rawData.don_vi_ban?.ten_cong_ty) || 'Mua lẻ / Cửa hàng tự do',
      tax_code: cleanString(rawData.seller?.tax_code || rawData.don_vi_ban?.ma_so_thue),
    },
    products: cleanItems(rawData.products || rawData.danh_sach_hang_hoa),
    summary: {
      total_amount: rawData.summary?.total_amount || rawData.tong_ket?.tong_tien_thanh_toan,
    },
  }
}

function calculateLineTotal(quantity, unitPrice) {
  const q = Number(quantity) || 0
  const p = Number(unitPrice) || 0
  return q * p
}

function validateAndFixInvoiceNumber(rawNumber) {
  if (!rawNumber) return ''
  const cleaned = String(rawNumber).trim()
  // Nếu là số 4 chữ số bắt đầu bằng 0 hoặc giá trị đáng ngờ như 6666, kiểm tra
  if (/^\d{4,}$/.test(cleaned) && (cleaned.startsWith('0') || cleaned === '6666')) {
    // Giữ nguyên nếu hợp lệ, nhưng log cảnh báo
    console.warn(`[OCR Validation] Số hóa đơn "${cleaned}" cần được xác minh lại`)
  }
  return cleaned
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseVietnamesePrice(rawPrice) {
  if (rawPrice === undefined || rawPrice === null) return 0
  if (rawPrice === 0) return 0

  let priceStr = String(rawPrice).trim()

  priceStr = priceStr.replace(/[\.,\sđVND]/g, '')

  const parsedNumber = parseInt(priceStr, 10)
  if (isNaN(parsedNumber)) return 0

  if (parsedNumber > 0 && parsedNumber < 1000) {
    return parsedNumber * 1000
  }

  return parsedNumber
}

function cleanAndNormalizeItems(rawItems = []) {
  const allItems = rawItems.map((item, idx) => {
    // Support both English (Gemini) and Vietnamese keys
    const rowType = item.row_type || item.loai_dong || 'MUA'
    const priceAfterVat = item.unit_price_after_vat || item.don_gia_sau_vat || 0
    const priceBeforeVat = item.unit_price_before_vat || item.don_gia_truoc_vat || 0
    const productCode = item.product_code || item.ma_hang_goc || ''

    return {
      ...item,
      _raw_index: idx,
      row_type: String(rowType).toUpperCase(),
      loai_dong: String(rowType).toUpperCase(), // backward compat
      product_code: String(productCode).trim(),
      ma_hang_goc: String(productCode).trim(), // backward compat
      ten_hang: normalizeProductName(item.item_name || item.ten_hang),
      item_name: normalizeProductName(item.item_name || item.ten_hang),
      don_vi_tinh: String(item.unit || item.don_vi_tinh || '').trim(),
      unit: String(item.unit || item.don_vi_tinh || '').trim(), // backward compat
      so_luong: Number(item.quantity || item.so_luong) || 0,
      quantity: Number(item.quantity || item.so_luong) || 0, // backward compat
      don_gia_sau_vat: parseVietnamesePrice(priceAfterVat),
      unit_price_after_vat: parseVietnamesePrice(priceAfterVat), // backward compat
      don_gia_truoc_vat: parseVietnamesePrice(priceBeforeVat),
      unit_price_before_vat: parseVietnamesePrice(priceBeforeVat), // backward compat
    }
  })

  const muaRows = allItems.filter((item) => {
    if (item.row_type === 'KM') return false
    return !isNonProductRow(item)
  })

  const kmRows = allItems.filter((item) => item.row_type === 'KM')

  const kmByRoot = new Map()
  muaRows.forEach((mua) => {
    const key = slugify(mua.ten_hang)
    if (!kmByRoot.has(key)) kmByRoot.set(key, [])
    kmByRoot.get(key).push(mua)
  })

  const enrichedMuaRows = muaRows.map((mua) => {
    const key = slugify(mua.ten_hang)
    const linkedKms = kmRows.filter((km) => {
      const kmKey = String(km.product_code || km.ma_hang_goc || '').trim()
      return kmKey && slugify(kmKey) === key
    })
    const totalGiftQty = linkedKms.reduce((sum, km) => sum + (km.quantity || km.so_luong || 0), 0)
    const firstKm = linkedKms[0]
    return {
      ...mua,
      _km_count: linkedKms.length,
      _km_total_qty: totalGiftQty,
      _km_unit: firstKm?.unit || firstKm?.don_vi_tinh || '',
      _km_items: linkedKms,
    }
  })

  return enrichedMuaRows
}

const BULK_UOM = ['THÙNG', 'KÉT', 'LỐC', 'BAO', 'HỘP', 'SET', 'BỘ']
const SMALL_UOM = ['CÁI', 'GÓI', 'VIÊN', 'LON', 'CHAI', 'TÚI', 'VĨ']

function calculateSmartRetailPrice(item = {}) {
  const uom = String(item.unit || item.don_vi_tinh || '').toUpperCase().trim()
  const price = parseVietnamesePrice(item.unit_price_after_vat || item.don_gia_sau_vat)

  const isBulk = BULK_UOM.some((u) => uom.includes(u))
  const isSmallUnit = SMALL_UOM.some((u) => uom.includes(u))

  const baseRetail = price * 1.15

  if (isBulk || price >= 10_000) {
    return Math.ceil(baseRetail / 1000) * 1000
  }

  if (isSmallUnit || price < 10_000) {
    return Math.ceil(baseRetail / 100) * 100
  }

  return Math.ceil(baseRetail / 1000) * 1000
}

function roundUpToThousands(value) {
  const n = Math.floor(Number(value) || 0)
  return n < 0 ? 0 : Math.ceil(n / 1000) * 1000
}

export default function HoaDonVAT() {
  const { inventory, vatInvoices, addVatInvoice, updateVatInvoice, deleteVatInvoice, companies, addCompany } = useApp()
  const [editingId, setEditingId] = useState(null)
  const [congTyName, setCongTyName] = useState('')
  const [congTyMst, setCongTyMst] = useState('')
  const [date, setDate] = useState(formatDateForInput(new Date()))
  const [invoiceSymbol, setInvoiceSymbol] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [groupKey, setGroupKey] = useState(inventory[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState(0)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [error, setError] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [isLoadingOCR, setIsLoadingOCR] = useState(false)
  const [ocrMessage, setOcrMessage] = useState('')
  const [retryableError, setRetryableError] = useState(null)
  const [ocrItems, setOcrItems] = useState([])
  // Bản sao có thể chỉnh sửa trực tiếp của ocrItems (sau khi cleanAndNormalizeItems)
  const [editableItems, setEditableItems] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [invoiceType, setInvoiceType] = useState('VAT')
  const [formErrors, setFormErrors] = useState({})
  const fileInputRef = useRef(null)
  // Helper: set cả error state lẫn floating toast cùng lúc
  const showError = useCallback((msg) => {
    setError(msg)
    if (msg) setToastMsg(msg)
  }, [])
  const dismissToast = useCallback(() => setToastMsg(''), [])
  // Refs cho validation scrolling và focus
  const errorRef = useRef(null)
  const congTyNameRef = useRef(null)
  const congTyMstRef = useRef(null)
  const invoiceSymbolRef = useRef(null)
  const invoiceNumberRef = useRef(null)
  const retailCongTyNameRef = useRef(null)
  const retailInvoiceNumberRef = useRef(null)
  const ocrAbortRef = useRef(null)
  const requestIdRef = useRef(0)

  // Duplicate check state
  const [duplicateInvoice, setDuplicateInvoice] = useState(null)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)

  // Image viewer state
  const [viewerImage, setViewerImage] = useState(null)

  const resetForm = () => {
    setEditingId(null)
    setInvoiceType('VAT')
    setCongTyName('')
    setCongTyMst('')
    setInvoiceSymbol('')
    setInvoiceNumber('')
    setGroupKey(inventory[0]?.id ?? '')
    setNote('')
    setAmount(0)
    setImageFile(null)
    setImagePreview(null)
    setDate(formatDateForInput(new Date()))
    setError('')
    setToastMsg('')
    setFormErrors({})
    setOcrMessage('')
    setOcrItems([])
    setEditableItems([])
    setDuplicateInvoice(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const ensureCompanyExists = (name, mst) => {
    const existed = companies.find((c) => c.name === name && c.mst === mst)
    if (existed) return existed.id
    const id = crypto.randomUUID()
    addCompany({ id, name, mst })
    return id
  }

  const handleFileChange = async (e) => {
    setError('')
    setToastMsg('')
    setOcrMessage('')
    setRetryableError(null)
    const file = e.target.files?.[0]
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      showError('Vui lòng chọn file ảnh (jpg, png, ...).')
      setImageFile(null)
      setImagePreview(null)
      return
    }
    // ── Auto-compress: không bao giờ reject ảnh lớn ──────────────────
    try {
      const isLarge = file.size > 500 * 1024
      if (isLarge) {
        setOcrMessage('📸 Đang nén ảnh từ điện thoại...')
      }
      const dataUrl = await compressToDataUrl(file, 500 * 1024)
      setImageFile(dataUrl)
      setImagePreview(dataUrl)
      setOcrMessage('')
      // Truyền file gốc cho Gemini — resizeAndCompressImage bên trong sẽ nén lại
      await handleInvoiceUpload(file)
    } catch (err) {
      showError(err.message || 'Không đọc được ảnh. Vui lòng thử lại.')
      setImageFile(null)
      setImagePreview(null)
    }
  }

  const applyOcrResult = (responseOrData) => {
    // Bước 1: Parse JSON từ response
    const data = responseOrData?.text ? (() => {
      const text = responseOrData.text?.trim()
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      const jsonString = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text
      return JSON.parse(jsonString)
    })() : responseOrData

    // Bước 2: Sanitize dữ liệu - loại bỏ chuỗi "null", "—", placeholder giả
    const cleaned = sanitizeOcrData(data)

    // UX Smart Form Mode Protection:
    // Chỉ Gemini mới ghi đè invoiceType khi user chưa chọn tab cụ thể.
    // Nếu user đang đứng ở tab RETAIL → giữ nguyên RETAIL, tuyệt đối không ép về VAT.
    const detectedType = (cleaned.invoice_type || 'VAT').toUpperCase()
    if (detectedType === 'RETAIL') {
      setInvoiceType('RETAIL')
    } else if (invoiceType !== 'RETAIL') {
      // Chỉ tự động điền VAT khi user chưa chủ động chọn RETAIL
      setInvoiceType('VAT')
    }

    // Bước 3: Điền dữ liệu đã làm sạch vào form (hỗ trợ cả English & Vietnamese keys)
    const sellerInfo = cleaned.seller || cleaned.don_vi_ban || {}
    const invoiceInfo = cleaned.invoice_info || cleaned.thong_tin_hoa_don || {}
    setCongTyName(sellerInfo.company_name || sellerInfo.ten_cong_ty || '')
    setCongTyMst(sellerInfo.tax_code || sellerInfo.ma_so_thue || '')

    const formattedDate = formatToInputDate(invoiceInfo.issue_date || invoiceInfo.ngay_xuat)
    if (formattedDate) {
      setDate(formattedDate)
    }

    // Validate số hóa đơn - không chấp nhận giá trị đáng ngờ
    const invoiceNum = validateAndFixInvoiceNumber(invoiceInfo.invoice_number || invoiceInfo.so_hoa_don)
    if (invoiceNum) setInvoiceNumber(invoiceNum)

    if (invoiceInfo.serial_number || invoiceInfo.ky_hieu) {
      setInvoiceSymbol(invoiceInfo.serial_number || invoiceInfo.ky_hieu)
    }

    // Parse và validate tổng tiền
    const summary = cleaned.summary || cleaned.tong_ket || {}
    const totalPayment = parseVietnamesePrice(summary.total_amount || summary.tong_tien_thanh_toan)
    if (totalPayment > 0) setAmount(totalPayment)

    // Bước 4: Làm sạch và lưu items
    const items = cleaned.products || cleaned.danh_sach_hang_hoa || []
    const normalizedItems = cleanAndNormalizeItems(items)
    saveToProductPriceBook(normalizedItems, invoiceInfo.issue_date || invoiceInfo.ngay_xuat || date, formatDateDisplay)
    setOcrItems(normalizedItems || [])
    setEditableItems(normalizedItems || [])
  }

  const handleInvoiceUpload = async (file) => {
    if (!file) {
      setError('Vui lòng chọn ảnh hóa đơn trước khi quét OCR.')
      return
    }

    if (ocrAbortRef.current) {
      ocrAbortRef.current.abort()
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
    const currentRequestId = ++requestIdRef.current
    ocrAbortRef.current = controller

    setIsLoadingOCR(true)
    setError('')
    setOcrMessage('Đang quét hóa đơn bằng AI...')
    setRetryableError(null)

    let lastError = null

    try {
      const imagePart = await fileToGenerativePart(file)
      const prompt = `You are an expert Vietnamese invoice OCR system. Extract data with CRITICAL DATA INTEGRITY rules.

CRITICAL DATA RULES:
1. INVOICE NUMBER EXTRACTION: Look at the upper-right corner for billing number (Số: XXXX). Extract ONLY what is actually printed. If the field is blank or empty on the paper, return null (no quotes). NEVER invent numbers like '6666' for invoices that don't have one.
2. TAX CODE (Mã số thuế): If not visible or blank, return null (proper JSON null, no quotes). Never write the literal string "null".
3. INVOICE SERIAL (Ký hiệu): If not printed, return null. Never repeat values from other fields.
4. MATHEMATICAL INTEGRITY: If 'Thành tiền' column is obscured, calculate: Line Total = Quantity × Unit Price. Sum all line totals for 'total_amount'.
5. EXTRACT ONLY REAL DATA: Do not fabricate, guess, or repeat placeholder values. Empty field = null.

CLASSIFY INVOICE TYPE:
- If invoice has Tax ID (MST) and formal serial/number format → invoice_type = 'VAT'
- If it's a retail receipt without full MST → invoice_type = 'RETAIL'

All monetary values must be returned as continuous integers without dots or commas (Example: '176727' not '176.727'). All prices are in thousands VND (176.727 = 176,727 VND).

PRODUCT EXTRACTION RULES:
- Preserve original unit of measure exactly (Thùng, Lốc, Két, Chai, Bao, Hộp, Lon, Gói, Cái...)
- If a line is promotional (price=0, name contains K.M/Khuyến mãi/Quà tặng) → row_type: 'KM'
- For KM lines, extract their exact unit of measure and set product_code to the product code of the matched MUA line above.
- Translate raw abbreviated product names to clear, readable standard Vietnamese. Clean and filter out rows that are purely discounts.
- For each item in the 'products' array, you must determine the 'row_type':
  - If the item has a price greater than 0, set 'row_type' to 'MUA'.
  - If the item is a promotional gift (the name contains 'K.M', 'KM', 'Khuyến mãi' and the price is 0), set 'row_type' to 'KM'.
  - Strictly use uppercase 'MUA' or 'KM' only, do not use lowercase or other words.

PRODUCT NAME TRANSLATION RULES (MANDATORY):
You are provided with a reference dictionary of Vietnamese grocery abbreviations. Use it strictly under these rules:
- ONLY match when the abbreviation stands as a SEPARATE, FULL WORD in the text (e.g., if code is 'KD', match 'Kinh Đô'. Do NOT match inside other words or partial letter groups).
- If an abbreviation appears ambiguous, use the invoice row context to pick the SINGLE best fitting meaning. NEVER combine multiple meanings into a chaotic sentence.
- Prioritize making the final product name sound natural, grammatically correct, and polite in Vietnamese. Do not insert dashes or extra punctuation between expanded words.
- If a word in the product name is NOT in the dictionary below, keep it exactly as it appears on the invoice — do NOT guess or translate it.

Here is the abbreviation dictionary for your reference:
${Object.entries(abbreviationDictionary)
          .map(([key, value]) => `  - '${key}' = '${value}'`)
          .join('\n')}

Return valid JSON only.`


      const GEMINI_RESPONSE_SCHEMA = {
        type: 'OBJECT',
        properties: {
          invoice_type: { type: 'STRING' },
          invoice_info: {
            type: 'OBJECT',
            properties: {
              serial_number: { type: 'STRING' },
              invoice_number: { type: 'STRING' },
              issue_date: { type: 'STRING' },
            },
          },
          seller: {
            type: 'OBJECT',
            properties: {
              company_name: { type: 'STRING' },
              tax_code: { type: 'STRING' },
            },
          },
          products: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                item_name: { type: 'STRING' },
                unit: { type: 'STRING' },
                quantity: { type: 'NUMBER' },
                unit_price_after_vat: { type: 'NUMBER' },
                unit_price_before_vat: { type: 'NUMBER' },
                row_type: { type: 'STRING' },
                product_code: { type: 'STRING' },
              },
            },
          },
          summary: {
            type: 'OBJECT',
            properties: {
              total_amount: { type: 'NUMBER' },
            },
          },
        },
      }

      const PRIMARY_MODEL = 'gemini-2.5-flash'
      const FALLBACK_MODEL = 'gemini-2.5-flash'
      const isOverloadError = (err) => {
        const s = err?.status || err?.code
        const m = String(err?.message || '')
        return s === 503 || s === 429 || /high demand|UNAVAILABLE|overloaded|busy/i.test(m)
      }

      const callWithModel = async (model) => {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                imagePart,
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            temperature: 0.1,
          },
          abortSignal: controller.signal,
        })
        return response
      }

      // ── Primary model ──
      let lastError = null
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (controller.signal.aborted) throw new Error('Quét OCR đã bị hủy.')
        setOcrMessage(getOcrStatusText(attempt, 'request'))
        try {
          clearTimeout(timeoutId)
          const response = await callWithModel(PRIMARY_MODEL)
          setOcrMessage(getOcrStatusText(attempt, 'parse'))
          applyOcrResult(response)
          setOcrMessage('Đã quét xong và tự động điền form.')
          return
        } catch (err) {
          lastError = err
          if (isOverloadError(err) && attempt < MAX_RETRIES) {
            const backoffTime = (Math.pow(2, attempt) - 1) * 1000
            setOcrMessage(getOcrStatusText(attempt, 'retry'))
            await delay(backoffTime)
          } else {
            break // overload but out of retries, or non-overload error
          }
        }
      }

      // ── Fallback model: chỉ thử khi lỗi là 503/429/overload ──
      if (isOverloadError(lastError)) {
        lastError = null
        setOcrMessage(getOcrStatusText(0, 'fallback'))
        await delay(1500) // đợi 1.5s trước khi gọi fallback
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (controller.signal.aborted) throw new Error('Quét OCR đã bị hủy.')
          setOcrMessage(`🤖 Đang thử lại lần ${attempt}/${MAX_RETRIES} với bộ xử lý dự phòng...`)
          try {
            clearTimeout(timeoutId)
            const response = await callWithModel(FALLBACK_MODEL)
            setOcrMessage(getOcrStatusText(attempt, 'parse'))
            applyOcrResult(response)
            setOcrMessage('Đã quét xong (bộ xử lý dự phòng) và tự động điền form.')
            return
          } catch (err) {
            lastError = err
            if (attempt < MAX_RETRIES) {
              const backoffTime = (Math.pow(2, attempt) - 1) * 1000
              await delay(backoffTime)
            }
          }
        }
      }

      // ── Thất bại sau cả 2 model → bắn lỗi lên UI ──
      clearTimeout(timeoutId)
      throw lastError
    } catch (err) {
      if (err?.name === 'AbortError') {
        showError(sanitizeErrorMessage(err))
        setOcrMessage('')
      } else {
        showError(sanitizeErrorMessage(err))
        setOcrMessage('')
        setRetryableError(err)
      }
      lastError = err
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsLoadingOCR(false)
        if (!lastError) {
          ocrAbortRef.current = null
        }
      }
    }
  }

  const handleSaveAll = async (e) => {
    e.preventDefault()
    setError('')
    setFormErrors({})

    const companyName = congTyName.trim()
    const companyMst = congTyMst.trim()
    const symbol = invoiceSymbol.trim()
    const number = invoiceNumber.trim()

    // ===========================
    // VALIDATION: VAT Invoice
    // ===========================
    if (invoiceType === 'VAT') {
      const missingFields = []

      // Kiểm tra và chặn chuỗi "null" thô
      if (!companyName || companyName.toLowerCase() === 'null') {
        missingFields.push('congTyName')
        setFormErrors(prev => ({ ...prev, congTyName: true }))
      }
      if (!companyMst || companyMst.toLowerCase() === 'null' || companyMst === '') {
        missingFields.push('congTyMst')
        setFormErrors(prev => ({ ...prev, congTyMst: true }))
      }
      if (!symbol || symbol.toLowerCase() === 'null') {
        missingFields.push('invoiceSymbol')
        setFormErrors(prev => ({ ...prev, invoiceSymbol: true }))
      }
      if (!number || number.toLowerCase() === 'null') {
        missingFields.push('invoiceNumber')
        setFormErrors(prev => ({ ...prev, invoiceNumber: true }))
      }

      if (missingFields.length > 0) {
        showError('❌ Lỗi: Hóa đơn VAT bắt buộc phải có đầy đủ Tên công ty, Mã số thuế, Ký hiệu và Số hóa đơn. Vui lòng kiểm tra hoặc chỉnh sửa lại dữ liệu quét AI!')
        // Smooth scroll đến vùng lỗi
        setTimeout(() => {
          if (errorRef.current) {
            errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          // Focus vào ô đầu tiên bị lỗi
          const focusMap = {
            congTyName: congTyNameRef,
            congTyMst: congTyMstRef,
            invoiceSymbol: invoiceSymbolRef,
            invoiceNumber: invoiceNumberRef,
          }
          const firstErrorField = missingFields[0]
          if (focusMap[firstErrorField]?.current) {
            focusMap[firstErrorField].current.focus()
          }
        }, 50)
        return
      }
    }

    // ===========================
    // VALIDATION: RETAIL Invoice
    // ===========================
    if (invoiceType === 'RETAIL') {
      const missingFields = []

      if (!companyName || companyName.toLowerCase() === 'null') {
        missingFields.push('congTyName')
        setFormErrors(prev => ({ ...prev, congTyName: true }))
      }
      if (!number || number.toLowerCase() === 'null') {
        missingFields.push('invoiceNumber')
        setFormErrors(prev => ({ ...prev, invoiceNumber: true }))
      }
      if (!amount || amount <= 0) {
        missingFields.push('amount')
        setFormErrors(prev => ({ ...prev, amount: true }))
      }

      if (missingFields.length > 0) {
        showError('❌ Vui lòng nhập đầy đủ Tên cửa hàng, Số phiếu và Tổng tiền của hóa đơn bán lẻ!')
        // Smooth scroll đến vùng lỗi
        setTimeout(() => {
          if (errorRef.current) {
            errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          // Focus vào ô đầu tiên bị lỗi
          const focusMap = {
            congTyName: retailCongTyNameRef,
            invoiceNumber: retailInvoiceNumberRef,
          }
          const firstErrorField = missingFields[0]
          if (focusMap[firstErrorField]?.current) {
            focusMap[firstErrorField].current.focus()
          }
        }, 50)
        return
      }
    }

    // Validate date
    if (!date) {
      showError('❌ Vui lòng chọn ngày xuất hóa đơn.')
      return
    }

    const selectedGroupId = groupKey || inventory[0]?.id
    if (!selectedGroupId) {
      showError('❌ Vui lòng chọn nhóm hàng.')
      return
    }

    setIsSaving(true)

    try {
      const useSupabase = isSupabaseConfigured()

      if (useSupabase) {
        // ===========================
        // Bước 1: Lưu / lấy nhà cung cấp (chỉ khi có MST)
        // ===========================
        let supplierId = null
        if (companyMst) {
          const { data: existingSupplier, error: supplierSelectError } = await supabase
            .from('suppliers')
            .select('id')
            .eq('tax_code', companyMst)
            .limit(1)

          if (supplierSelectError) {
            throw new Error(`Không thể kiểm tra nhà cung cấp: ${supplierSelectError.message}`)
          }

          if (existingSupplier && existingSupplier.length > 0) {
            supplierId = existingSupplier[0].id
          } else {
            const { data: newSupplier, error: supplierInsertError } = await supabase
              .from('suppliers')
              .insert([{ tax_code: companyMst, company_name: companyName }])
              .select()
              .single()

            if (supplierInsertError) {
              throw new Error(`Không thể tạo nhà cung cấp: ${supplierInsertError.message}`)
            }
            supplierId = newSupplier.id
          }
        }

        // ===========================
        // Kiểm tra trùng lặp hóa đơn (theo số HĐ + tổng tiền)
        // ===========================
        const normalizedInvoiceNumber = String(invoiceNumber || '').trim()
        if (normalizedInvoiceNumber) {
          const { data: duplicateInvoices, error: duplicateError } = await supabase
            .from('invoices')
            .select('id, invoice_number, total_amount, issue_date')
            .eq('invoice_number', normalizedInvoiceNumber)
            .eq('total_amount', Number(amount) || 0)
            .limit(1)

          if (duplicateError) {
            throw new Error(`Không thể kiểm tra trùng lặp hóa đơn: ${duplicateError.message}`)
          }

          if (duplicateInvoices && duplicateInvoices.length > 0) {
            const dup = duplicateInvoices[0]
            setDuplicateInvoice({
              invoice_number: dup.invoice_number,
              total_amount: dup.total_amount,
              issue_date: dup.issue_date,
              id: dup.id,
            })
            setIsSaving(false)
            return
          }
        }

        // ===========================
        // Upload ảnh hóa đơn lên Supabase Storage
        // ===========================
        let uploadedImageUrl = null
        if (imageFile) {
          try {
            // imageFile có thể là chuỗi base64 data URL (từ OCR) hoặc File object
            let fileToUpload = imageFile
            if (typeof imageFile === 'string' && imageFile.startsWith('data:')) {
              fileToUpload = dataUrlToBlob(imageFile)
              if (!fileToUpload) throw new Error('Không chuyển được ảnh sang Blob để upload.')
            }

            const compressedFile = await resizeAndCompressImage(fileToUpload)

            // Đặt tên file độc nhất theo số HĐ + timestamp để tránh trùng đè
            const safeNumber = String(invoiceNumber || '').trim().replace(/[^a-zA-Z0-9]/g, '_') || 'invoice'
            const filePath = `${Date.now()}_${safeNumber}.jpg`

            console.log(`[Storage] Uploading: ${filePath} (size: ${compressedFile.size} bytes)`)

            const { error: uploadError } = await supabase.storage
              .from('invoice-images')
              .upload(filePath, compressedFile, {
                contentType: 'image/jpeg',
                upsert: false,
              })

            if (uploadError) {
              console.error('Chi tiết lỗi Storage:', uploadError)
              throw uploadError
            }

            const { data: publicData } = supabase.storage
              .from('invoice-images')
              .getPublicUrl(filePath)

            uploadedImageUrl = publicData?.publicUrl || null
            console.log(`[Storage] Upload thành công: ${uploadedImageUrl}`)
          } catch (err) {
            console.error('Chi tiết lỗi Storage:', err)
            throw new Error(`Không thể tải ảnh hóa đơn lên kho lưu trữ. Chi tiết: ${err?.message}`)
          }
        }

        // ===========================
        // Bước 2: Lưu hóa đơn (đảm bảo không có chuỗi "null")
        // ===========================
        const sanitizeForDb = (val) => {
          if (!val) return null
          const trimmed = String(val).trim()
          if (trimmed.toLowerCase() === 'null' || trimmed === '—' || trimmed === '') return null
          return trimmed
        }

        // Chuẩn hóa RETAIL: tax_code bắt buộc là null, không chuỗi "null"
        const isRetailInvoice = invoiceType === 'RETAIL'
        const companyMstValue = isRetailInvoice ? null : companyMst

        const invoicePayload = {
          invoice_type: invoiceType,
          serial_number: sanitizeForDb(invoiceSymbol),
          invoice_number: sanitizeForDb(invoiceNumber),
          issue_date: date,
          total_amount: Number(amount) || 0,
          notes: sanitizeForDb(note),
          supplier_id: supplierId,
          image_url: uploadedImageUrl,
        }

        const { data: newInvoice, error: invoiceInsertError } = await supabase
          .from('invoices')
          .insert([invoicePayload])
          .select()
          .single()

        if (invoiceInsertError) {
          throw new Error(`Không thể lưu hóa đơn: ${invoiceInsertError.message}`)
        }

        const invoiceId = newInvoice.id

        // ===========================
        // Bước 3: Lưu sản phẩm & lịch sử giá (dùng editableItems — đã bao gồm chỉnh sửa của user)
        // ===========================
        const cleaned = editableItems

        for (const item of cleaned) {
          const { data: existingProduct, error: productSelectError } = await supabase
            .from('products')
            .select('id')
            .eq('product_name', item.ten_hang)
            .limit(1)

          if (productSelectError) {
            throw new Error(`Không thể kiểm tra sản phẩm "${item.ten_hang}": ${productSelectError.message}`)
          }

          let productId
          if (existingProduct && existingProduct.length > 0) {
            productId = existingProduct[0].id
          } else {
            const { data: newProduct, error: productInsertError } = await supabase
              .from('products')
              .insert([{
                product_name: item.ten_hang,
                unit: item.don_vi_tinh,
                status: 'ACTIVE',
              }])
              .select()
              .single()

            if (productInsertError) {
              throw new Error(`Không thể tạo sản phẩm "${item.ten_hang}": ${productInsertError.message}`)
            }
            productId = newProduct.id
          }

          const suggestedPrice = calculateSmartRetailPrice(item)

          // Validate row_type strictly for Check Constraint
          const rawRowType = item.row_type || item.rowType;
          let validatedRowType = 'MUA';

          if (rawRowType) {
            const cleanType = String(rawRowType).trim().toUpperCase();
            if (cleanType === 'MUA' || cleanType === 'KM') {
              validatedRowType = cleanType;
            }
          } else if (Number(item.unit_price_after_vat) === 0) {
            validatedRowType = 'KM';
          }

          const { error: historyInsertError } = await supabase
            .from('price_history')
            .insert([{
              product_id: productId,
              invoice_id: invoiceId,
              import_date: date,
              unit_price_after_vat: item.unit_price_after_vat,
              quantity: item.so_luong || 0,
              row_type: validatedRowType,
              suggested_retail_price: suggestedPrice,
              is_active_price: true,
            }])

          if (historyInsertError) {
            throw new Error(`Không thể lưu lịch sử giá cho "${item.ten_hang}": ${historyInsertError.message}`)
          }
        }

        if (cleaned.length) {
          saveToProductPriceBook(cleaned, date, formatDateDisplay)
        }
      } else {
        // Fallback localStorage nếu chưa cấu hình Supabase
        ensureCompanyExists(companyName, companyMst)

        const payload = {
          invoiceType,
          companyName,
          companyMst,
          date,
          invoiceSymbol: invoiceSymbol.trim(),
          invoiceNumber: invoiceNumber.trim(),
          groupKey: selectedGroupId,
          note: note.trim(),
          amount,
          imageBase64: imageFile || undefined,
        }
        if (editingId) {
          updateVatInvoice(editingId, payload)
        } else {
          addVatInvoice(payload)
        }

        const cleaned = editableItems
        if (cleaned.length) {
          saveToProductPriceBook(cleaned, date, formatDateDisplay)
        }
      }

      resetForm()
      setOcrMessage('Đã lưu hóa đơn và cập nhật danh mục/giá thành công.')
    } catch (err) {
      showError(err?.message || 'Lỗi khi lưu hóa đơn lên hệ thống.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col gap-3 mb-4 flex-shrink-0 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-xl font-bold text-brand-700 m-0 lg:text-2xl">Nhập hóa đơn</h1>

        {/* Tab Switcher — Invoice Type */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-sm font-medium text-slate-500">Loại hóa đơn:</span>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-slate-50">
            <button
              type="button"
              id="tab-vat"
              onClick={() => setInvoiceType('VAT')}
              className={`px-4 py-2 text-sm font-semibold transition-all duration-200 ${invoiceType === 'VAT'
                ? 'bg-[#1e3a5f] text-white shadow-inner'
                : 'bg-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-100 border-r border-slate-200'
                }`}
            >
              📄 Hóa đơn VAT
            </button>
            <button
              type="button"
              id="tab-retail"
              onClick={() => setInvoiceType('RETAIL')}
              className={`px-4 py-2 text-sm font-semibold transition-all duration-200 ${invoiceType === 'RETAIL'
                ? 'bg-[#1e3a5f] text-white shadow-inner'
                : 'bg-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                }`}
            >
              🛒 Bán lẻ
            </button>
          </div>
        </div>
      </div>

      {/* ── SPLIT-SCREEN MAIN CONTENT ── */}
      <div className="flex flex-col gap-4 flex-1 min-h-0 lg:flex-row lg:gap-5 lg:items-start">

        {/* ══ LEFT COLUMN — Upload & Preview (40% on desktop, full on mobile) ══ */}
        <div className="flex flex-col gap-3 lg:w-[40%] lg:flex-shrink-0">

          {/* Upload / Preview Zone */}
          <div
            id="invoice-dropzone"
            className={`relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer overflow-hidden
              h-[200px] lg:h-auto lg:flex-1 lg:min-h-[340px] ${isLoadingOCR
                ? 'border-blue-300 bg-blue-50/60 animate-pulse cursor-default'
                : imageFile
                  ? 'border-slate-200 bg-slate-50 hover:border-blue-300'
                  : 'border-slate-300 bg-slate-50 hover:border-[#1e3a5f] hover:bg-blue-50/30'
              }`}
            onClick={isLoadingOCR ? undefined : () => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (!isLoadingOCR) fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {isLoadingOCR ? (
              <div className="flex flex-col items-center gap-3 px-6">
                <div className="h-12 w-12 rounded-full border-4 border-blue-100 border-t-[#1e3a5f] animate-spin" />
                <p className="text-sm font-semibold text-[#1e3a5f]">🤖 Gemini đang phân tích...</p>
                <p className="text-xs text-slate-400">{ocrMessage || 'Vui lòng đợi trong giây lát'}</p>
              </div>
            ) : imageFile ? (
              <div className="flex flex-col items-center gap-3 w-full h-full p-3">
                <img
                  src={imagePreview}
                  alt="Xem trước hóa đơn"
                  className="flex-1 w-full rounded-xl object-contain shadow-md"
                  style={{ maxHeight: 'calc(100% - 80px)' }}
                />
                <div className="flex flex-wrap items-center gap-2 justify-center flex-shrink-0">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    onClick={(e) => { e.stopPropagation(); setViewerImage(imagePreview) }}
                  >
                    🖼️ Xem đầy đủ
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageFile(null); setImagePreview(null)
                      setOcrItems([]); setEditableItems([])
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    ✕ Bỏ ảnh
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e3a5f] text-white hover:bg-[#16304f] transition-colors shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      const file = fileInputRef.current?.files?.[0]
                      if (file) handleInvoiceUpload(file)
                    }}
                  >
                    🔄 Quét lại
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl shadow-inner">
                  📤
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Kéo thả ảnh hóa đơn vào đây</p>
                  <p className="text-xs text-slate-400 mt-1">hoặc nhấp để chọn file</p>
                </div>
                <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">JPG · PNG · PDF</span>
              </div>
            )}
          </div>

          {/* OCR success/info status — green or blue pill */}
          {ocrMessage && !isLoadingOCR && (
            <div className={`px-4 py-3 rounded-xl text-xs font-medium flex-shrink-0 ${ocrMessage.includes('thành công') || ocrMessage.includes('xong')
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
              {ocrMessage}
            </div>
          )}
        </div>

        {/* ══ RIGHT COLUMN — Form Card (60% on desktop, full on mobile) ══ */}
        <div className="flex-1 min-w-0 flex flex-col lg:sticky lg:top-4 lg:self-start">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">

            {/* Card Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex-shrink-0 lg:px-6 lg:py-4">
              <h2 className="text-base font-bold text-slate-800 m-0">
                {invoiceType === 'VAT' ? 'Thông tin hóa đơn VAT' : 'Thông tin hóa đơn bán lẻ'}
              </h2>
              {isLoadingOCR && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-3 w-3 rounded-full bg-blue-400 animate-ping" />
                  <span className="text-xs font-medium text-blue-600">Đang điền dữ liệu tự động...</span>
                </div>
              )}
            </div>

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 lg:px-6 lg:py-5">
              <form id="vat-form" onSubmit={handleSaveAll}>

                {/* ─── VAT FORM ─── */}
                {invoiceType === 'VAT' && (
                  <div className="flex flex-col gap-4">

                    {/* Row 1: Tên NCC — full width */}
                    <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Tên nhà cung cấp / Công ty
                      </label>
                      {isLoadingOCR
                        ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                        : (
                          <input
                            type="text"
                            value={congTyName}
                            onChange={(e) => {
                              setCongTyName(e.target.value)
                              if (e.target.value) setFormErrors(prev => { const n = { ...prev }; delete n.congTyName; return n })
                            }}
                            placeholder="Nhập tên công ty..."
                            ref={congTyNameRef}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 bg-white outline-none transition focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${formErrors.congTyName ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 hover:border-slate-300'}`}
                          />
                        )
                      }
                    </div>

                    {/* Row 2: MST | Ngày xuất VAT */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Mã số thuế đối tác
                        </label>
                        {isLoadingOCR
                          ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                          : (
                            <input
                              type="text"
                              value={congTyMst}
                              onChange={(e) => {
                                setCongTyMst(e.target.value)
                                if (e.target.value) setFormErrors(prev => { const n = { ...prev }; delete n.congTyMst; return n })
                              }}
                              placeholder="VD: 0123456789"
                              ref={congTyMstRef}
                              className={`w-full rounded-lg border px-3 py-2.5 text-base text-slate-800 bg-white outline-none transition focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${formErrors.congTyMst ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 hover:border-slate-300'}`}
                            />
                          )
                        }
                      </div>
                      <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Ngày xuất VAT <span className="text-red-500 normal-case font-bold">*</span>
                        </label>
                        {isLoadingOCR
                          ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                          : <DatePicker value={date} onChange={setDate} required aria-label="Chọn ngày" />
                        }
                      </div>
                    </div>

                    {/* Row 3: Ký hiệu | Số HĐ */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Ký hiệu hóa đơn
                        </label>
                        {isLoadingOCR
                          ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                          : (
                            <input
                              type="text"
                              value={invoiceSymbol}
                              onChange={(e) => {
                                setInvoiceSymbol(e.target.value)
                                if (e.target.value) setFormErrors(prev => { const n = { ...prev }; delete n.invoiceSymbol; return n })
                              }}
                              placeholder="VD: AA/23"
                              ref={invoiceSymbolRef}
                              className={`w-full rounded-lg border px-3 py-2.5 text-base text-slate-800 bg-white outline-none transition focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${formErrors.invoiceSymbol ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 hover:border-slate-300'}`}
                            />
                          )
                        }
                      </div>
                      <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Số hóa đơn
                        </label>
                        {isLoadingOCR
                          ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                          : (
                            <input
                              type="text"
                              value={invoiceNumber}
                              onChange={(e) => {
                                setInvoiceNumber(e.target.value)
                                if (e.target.value) setFormErrors(prev => { const n = { ...prev }; delete n.invoiceNumber; return n })
                              }}
                              placeholder="VD: 00004402"
                              ref={invoiceNumberRef}
                              className={`w-full rounded-lg border px-3 py-2.5 text-base text-slate-800 bg-white outline-none transition focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${formErrors.invoiceNumber ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 hover:border-slate-300'}`}
                            />
                          )
                        }
                      </div>
                    </div>

                    {/* Row 4: Số tiền — full width */}
                    <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Số tiền (VND)
                      </label>
                      {isLoadingOCR
                        ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                        : (
                          <VndInput
                            value={amount}
                            onChange={(val) => {
                              setAmount(val)
                              if (val > 0) setFormErrors(prev => { const n = { ...prev }; delete n.amount; return n })
                            }}
                            placeholder="1.500.000"
                            className={formErrors.amount ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}
                          />
                        )
                      }
                    </div>

                    {/* Row 5: Ghi chú — full width */}
                    <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Ghi chú
                      </label>
                      {isLoadingOCR
                        ? <div className="h-16 rounded-lg bg-slate-200 animate-pulse" />
                        : (
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Ghi chú thêm về hóa đơn này..."
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 hover:border-slate-300 px-3 py-2.5 text-base text-slate-800 bg-white outline-none transition focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none"
                          />
                        )
                      }
                    </div>
                  </div>
                )}

                {/* ─── RETAIL FORM ─── */}
                {invoiceType === 'RETAIL' && (
                  <div className="flex flex-col gap-4">

                    {/* Row 1: Tên cửa hàng — full width */}
                    <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Nơi mua hàng / Tên cửa hàng
                      </label>
                      {isLoadingOCR
                        ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                        : (
                          <input
                            type="text"
                            value={congTyName}
                            onChange={(e) => {
                              setCongTyName(e.target.value)
                              if (e.target.value) setFormErrors(prev => { const n = { ...prev }; delete n.congTyName; return n })
                            }}
                            placeholder="VD: Siêu thị CoopMart, Cửa hàng tạp hóa..."
                            ref={retailCongTyNameRef}
                            className={`w-full rounded-lg border px-3 py-2.5 text-base text-slate-800 bg-white outline-none transition focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${formErrors.congTyName ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 hover:border-slate-300'}`}
                          />
                        )
                      }
                    </div>

                    {/* Row 2: Số phiếu | Ngày xuất */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Số phiếu / Mã đơn
                        </label>
                        {isLoadingOCR
                          ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                          : (
                            <input
                              type="text"
                              value={invoiceNumber}
                              onChange={(e) => {
                                setInvoiceNumber(e.target.value)
                                if (e.target.value) setFormErrors(prev => { const n = { ...prev }; delete n.invoiceNumber; return n })
                              }}
                              placeholder="VD: HD001234"
                              ref={retailInvoiceNumberRef}
                              className={`w-full rounded-lg border px-3 py-2.5 text-base text-slate-800 bg-white outline-none transition focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${formErrors.invoiceNumber ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 hover:border-slate-300'}`}
                            />
                          )
                        }
                      </div>
                      <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Ngày xuất hóa đơn <span className="text-red-500 normal-case font-bold">*</span>
                        </label>
                        {isLoadingOCR
                          ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                          : <DatePicker value={date} onChange={setDate} required aria-label="Chọn ngày" />
                        }
                      </div>
                    </div>

                    {/* Row 3: Số tiền — full width */}
                    <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Số tiền (VND)
                      </label>
                      {isLoadingOCR
                        ? <div className="h-10 rounded-lg bg-slate-200 animate-pulse" />
                        : (
                          <VndInput
                            value={amount}
                            onChange={(val) => {
                              setAmount(val)
                              if (val > 0) setFormErrors(prev => { const n = { ...prev }; delete n.amount; return n })
                            }}
                            placeholder="1.500.000"
                            className={formErrors.amount ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}
                          />
                        )
                      }
                    </div>

                    {/* Row 4: Ghi chú — full width */}
                    <div className={`form-group m-0 ${isLoadingOCR ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Ghi chú
                      </label>
                      {isLoadingOCR
                        ? <div className="h-16 rounded-lg bg-slate-200 animate-pulse" />
                        : (
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Ghi chú thêm..."
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 hover:border-slate-300 px-3 py-2.5 text-base text-slate-800 bg-white outline-none transition focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none"
                          />
                        )
                      }
                    </div>
                  </div>
                )}

              </form>
            </div>

            {/* errorRef anchor for scrollIntoView (invisible) */}
            <div ref={errorRef} />

            {/* ── Card Footer: Action Buttons ── */}
            <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-2 flex-shrink-0 bg-slate-50/50 rounded-b-2xl sm:flex-row sm:items-center sm:justify-end sm:gap-3 lg:px-6">
              <button
                type="button"
                id="btn-cancel"
                className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 shadow-sm min-h-[48px] sm:min-h-0"
                onClick={resetForm}
                disabled={isLoadingOCR || isSaving}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                id="btn-save"
                form="vat-form"
                className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] active:bg-[#0f2340] transition-all duration-150 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] sm:min-h-0"
                disabled={isLoadingOCR || isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang đồng bộ...
                  </>
                ) : (
                  <>Xác nhận lưu</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── ITEMS TABLE (below split-screen) ── */}
      {editableItems.length > 0 && (
        <div className="card mt-5 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800 m-0">
              Danh sách mặt hàng bóc tách
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1e3a5f] text-white text-xs font-bold">
                {editableItems.length}
              </span>
            </h2>
            <span className="text-xs text-slate-400 hidden sm:block">Chỉnh sửa trực tiếp trước khi lưu</span>
          </div>
          {/* ── MOBILE CARD LIST (hidden on lg+) ── */}
          <div className="flex flex-col gap-3 lg:hidden">
            {editableItems.map((item, idx) => {
              const price = item.don_gia_sau_vat || 0
              const suggested = item._suggested_retail != null
                ? item._suggested_retail
                : calculateSmartRetailPrice(item)
              const hasGift = (item._km_count || 0) > 0
              const giftNote = hasGift
                ? `🎁 Tặng kèm ${item._km_total_qty || 0} ${item._km_unit || ''}`.trim()
                : ''
              return (
                <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  {/* Row 1: STT badge + Tên sản phẩm full width */}
                  <div className="flex items-start gap-2 mb-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={item.ten_hang || ''}
                      onChange={(e) => handleProductFieldChange(idx, 'ten_hang', e.target.value)}
                      className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border-0 outline-none focus:ring-1 focus:ring-[#1e3a5f]/30 rounded px-1 -ml-1 min-w-0"
                    />
                  </div>
                  {/* Row 2: 3-col micro-grid — ĐVT / Giá nhập / Giá bán */}
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5">
                    {/* ĐVT */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">ĐVT</span>
                      <input
                        type="text"
                        value={item.don_vi_tinh || ''}
                        onChange={(e) => handleProductFieldChange(idx, 'don_vi_tinh', e.target.value)}
                        className="text-sm font-medium text-slate-700 bg-transparent border-0 outline-none focus:ring-1 focus:ring-[#1e3a5f]/30 rounded px-1 w-full"
                      />
                    </div>
                    {/* Giá nhập */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Giá nhập</span>
                      <input
                        type="text"
                        value={price.toLocaleString('vi-VN')}
                        onChange={(e) => handleProductFieldChange(idx, 'don_gia_sau_vat', e.target.value)}
                        className="text-sm font-medium text-slate-700 bg-transparent border-0 outline-none focus:ring-1 focus:ring-[#1e3a5f]/30 rounded px-1 w-full"
                      />
                    </div>
                    {/* Giá bán đề xuất */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Giá bán</span>
                      <span className="text-sm font-bold text-emerald-600 px-1">
                        {suggested.toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                  {/* Gift note (if any) */}
                  {giftNote && (
                    <div className="mt-2 text-xs text-[#1e3a5f] font-medium bg-blue-50 rounded-lg px-2.5 py-1.5">
                      {giftNote}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* ── DESKTOP TABLE (hidden on mobile, visible on lg+) ── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-600 text-left border-b border-slate-200 whitespace-nowrap w-10">STT</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-600 text-left border-b border-slate-200">Tên sản phẩm</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-600 text-center border-b border-slate-200 whitespace-nowrap w-24">Đơn vị tính</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-600 text-right border-b border-slate-200 whitespace-nowrap w-32">Giá nhập / ĐVT</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-600 text-right border-b border-slate-200 whitespace-nowrap w-32">Giá bán / ĐVT</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-slate-600 text-left border-b border-slate-200">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {editableItems.map((item, idx) => {
                  const price = item.don_gia_sau_vat || 0
                  const suggested = item._suggested_retail != null
                    ? item._suggested_retail
                    : calculateSmartRetailPrice(item)
                  const hasGift = (item._km_count || 0) > 0
                  const giftNote = hasGift ? `🎁 Được tặng kèm ${item._km_total_qty || 0} ${item._km_unit || ''}`.trim() : ''
                  const packagingBadge = hasGift && BULK_UOM.some((u) => (item.don_vi_tinh || '').toUpperCase().includes(u))
                    ? `Nhập ${item.so_luong || 0} ${item.don_vi_tinh || ''} + tặng ${item._km_total_qty || 0} ${item._km_unit || ''}. Kiểm tra quy cách đóng gói để định giá chính xác.`
                    : ''
                  return (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2 text-xs text-slate-400 font-medium">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.ten_hang || ''}
                          onChange={(e) => handleProductFieldChange(idx, 'ten_hang', e.target.value)}
                          className="w-full bg-transparent border-0 focus:ring-1 focus:ring-[#1e3a5f]/30 p-1 rounded text-sm text-slate-800 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="text"
                          value={item.don_vi_tinh || ''}
                          onChange={(e) => handleProductFieldChange(idx, 'don_vi_tinh', e.target.value)}
                          className="w-16 text-center bg-transparent border-0 focus:ring-1 focus:ring-[#1e3a5f]/30 text-sm text-slate-700 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="text"
                          value={price.toLocaleString('vi-VN')}
                          onChange={(e) => handleProductFieldChange(idx, 'don_gia_sau_vat', e.target.value)}
                          className="w-28 text-right bg-transparent border-0 focus:ring-1 focus:ring-[#1e3a5f]/30 text-sm text-slate-700 outline-none pr-1"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-emerald-600 whitespace-nowrap">
                        {suggested.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-3 py-2">
                        {giftNote && <div className="text-xs text-[#1e3a5f] font-medium whitespace-nowrap">{giftNote}</div>}
                        {packagingBadge && (
                          <div className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            {packagingBadge}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Image Viewer Modal ── */}
      {viewerImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewerImage(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl rounded-xl bg-black p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white hover:bg-black/80"
              onClick={() => setViewerImage(null)}
            >
              ✕ Đóng
            </button>
            <img
              src={viewerImage}
              alt="Xem ảnh hóa đơn"
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}

      {/* ── Duplicate Invoice Confirm Dialog ── */}
      <ConfirmDialog
        open={!!duplicateInvoice}
        onClose={() => setDuplicateInvoice(null)}
        onConfirm={async () => {
          setDuplicateInvoice(null)
          setIsSaving(true)
          try {
            const useSupabase = isSupabaseConfigured()
            if (!useSupabase) {
              showError('Chưa kết nối Supabase.')
              setIsSaving(false)
              return
            }

            const companyMst = congTyMst.trim()
            let supplierId = null
            if (companyMst) {
              const { data: existingSupplier } = await supabase
                .from('suppliers').select('id').eq('tax_code', companyMst).limit(1)
              if (existingSupplier && existingSupplier.length > 0) {
                supplierId = existingSupplier[0].id
              }
            }

            let uploadedImageUrl = null
            if (imageFile) {
              try {
                let fileToUpload = imageFile
                if (typeof imageFile === 'string' && imageFile.startsWith('data:')) {
                  fileToUpload = dataUrlToBlob(imageFile)
                  if (!fileToUpload) throw new Error('Không chuyển được ảnh sang Blob để upload.')
                }
                const compressedFile = await resizeAndCompressImage(fileToUpload)
                const safeNumber = String(invoiceNumber || '').trim().replace(/[^a-zA-Z0-9]/g, '_') || 'invoice'
                const filePath = `${Date.now()}_${safeNumber}.jpg`
                const { error: uploadError } = await supabase.storage
                  .from('invoice-images').upload(filePath, compressedFile, { contentType: 'image/jpeg', upsert: false })
                if (uploadError) throw uploadError
                const { data: publicData } = supabase.storage.from('invoice-images').getPublicUrl(filePath)
                uploadedImageUrl = publicData?.publicUrl || null
              } catch (err) {
                console.error('Chi tiết lỗi Storage (duplicate confirm):', err)
              }
            }

            const sanitizeForDb = (val) => {
              if (!val) return null
              const trimmed = String(val).trim()
              if (trimmed.toLowerCase() === 'null' || trimmed === '—' || trimmed === '') return null
              return trimmed
            }

            const isRetailInvoice = invoiceType === 'RETAIL'
            const invoicePayload = {
              invoice_type: invoiceType,
              serial_number: sanitizeForDb(invoiceSymbol),
              invoice_number: sanitizeForDb(invoiceNumber),
              issue_date: date,
              total_amount: Number(amount) || 0,
              notes: sanitizeForDb(note),
              supplier_id: isRetailInvoice ? null : supplierId,
              image_url: uploadedImageUrl,
            }

            const { data: newInvoice, error: invoiceInsertError } = await supabase.from('invoices').insert([invoicePayload]).select().single()
            if (invoiceInsertError) throw new Error(`Không thể lưu hóa đơn: ${invoiceInsertError.message}`)

            const invoiceId = newInvoice.id
            const cleaned = editableItems
            for (const item of cleaned) {
              const { data: existingProduct } = await supabase.from('products').select('id').eq('product_name', item.ten_hang).limit(1)
              let productId
              if (existingProduct && existingProduct.length > 0) {
                productId = existingProduct[0].id
              } else {
                const { data: newProduct } = await supabase.from('products').insert([{ product_name: item.ten_hang, unit: item.don_vi_tinh, status: 'ACTIVE' }]).select().single()
                productId = newProduct.id
              }
              const suggestedPrice = calculateSmartRetailPrice(item)
              const rawRowType = item.row_type || item.rowType
              let validatedRowType = 'MUA'
              if (rawRowType) {
                const cleanType = String(rawRowType).trim().toUpperCase()
                if (cleanType === 'MUA' || cleanType === 'KM') validatedRowType = cleanType
              } else if (Number(item.unit_price_after_vat) === 0) {
                validatedRowType = 'KM'
              }
              await supabase.from('price_history').insert([{
                product_id: productId,
                invoice_id: invoiceId,
                import_date: date,
                unit_price_after_vat: item.unit_price_after_vat,
                quantity: item.so_luong || 0,
                row_type: validatedRowType,
                suggested_retail_price: suggestedPrice,
                is_active_price: true,
              }])
            }
            if (cleaned.length) saveToProductPriceBook(cleaned, date, formatDateDisplay)

            resetForm()
            setOcrMessage('Đã lưu hóa đơn trùng lặp thành công.')
          } catch (err) {
            showError(err?.message || 'Lỗi khi lưu hóa đơn.')
          } finally {
            setIsSaving(false)
          }
        }}
        title="⚠️ Cảnh báo: Hóa đơn trùng lặp"
        variant="warning"
        loading={isSaving}
      >
        {duplicateInvoice && (
          <div className="space-y-2">
            <p>Hóa đơn số <strong className="text-red-600">{duplicateInvoice.invoice_number}</strong> với số tiền này đã tồn tại trên hệ thống.</p>
            <p className="text-sm text-slate-600">
              Số tiền: <strong>{Number(duplicateInvoice.total_amount || 0).toLocaleString('vi-VN')}đ</strong>
              {duplicateInvoice.issue_date && (
                <> · Ngày: <strong>{duplicateInvoice.issue_date}</strong></>
              )}
            </p>
            <p className="text-sm text-amber-600 font-medium">Bạn có chắc chắn muốn tiếp tục lưu trùng không?</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
