// Hiển thị ngày theo dd/MM/yyyy (ví dụ: 25/01/2026)
export function formatDateDisplay(str) {
  if (!str) return ''
  const parts = str.split('-')
  if (parts.length !== 3) return str
  const [y, m, d] = parts
  const dd = String(d).padStart(2, '0')
  const MM = String(m).padStart(2, '0')
  return `${dd}/${MM}/${y}`
}

// Chuyển sang chuỗi yyyy-mm-dd (lưu nội bộ)
export function formatDateForInput(d) {
  if (!d) return ''
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return typeof d === 'string' ? d : ''
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Parse chuỗi dd/MM/yyyy hoặc d/M/yyyy → yyyy-mm-dd (trả về null nếu không hợp lệ)
export function parseDateDDMMYYYY(str) {
  if (!str || typeof str !== 'string') return null
  const s = str.trim().replace(/-/g, '/')
  const parts = s.split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 3) return null
  const dd = parseInt(parts[0], 10)
  const MM = parseInt(parts[1], 10)
  const yyyy = parseInt(parts[2], 10)
  if (Number.isNaN(dd) || Number.isNaN(MM) || Number.isNaN(yyyy)) return null
  if (dd < 1 || dd > 31 || MM < 1 || MM > 12 || yyyy < 1900 || yyyy > 2100) return null
  const d = String(dd).padStart(2, '0')
  const m = String(MM).padStart(2, '0')
  return `${yyyy}-${m}-${d}`
}
