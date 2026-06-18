// Làm tròn xuống tới hàng nghìn (23.570.043 → 23.570.000) để ghi sổ
export function roundToThousands(num) {
  if (num == null || Number.isNaN(num)) return 0
  const n = Math.floor(Number(num))
  return n < 0 ? 0 : Math.floor(n / 1000) * 1000
}

// Hiển thị số tiền VND: làm tròn tới nghìn, dấu chấm ngăn cách (23.570.000)
export function formatVnd(num) {
  const n = roundToThousands(num)
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Chỉ thêm dấu chấm, không làm tròn — dùng khi đang gõ trong ô nhập
export function formatVndInputDisplay(num) {
  if (num == null || Number.isNaN(num)) return ''
  const n = Math.floor(Number(num))
  if (n <= 0) return ''
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Hiển thị số tiền đúng như số (có dấu chấm, không làm tròn) — dùng cho VAT, v.v.
export function formatVndExact(num) {
  if (num == null || Number.isNaN(num)) return '0'
  const n = Number(num)
  if (n < 0) return '0'
  return n.toLocaleString('vi-VN')
}

// Parse chuỗi nhập (có dấu chấm hoặc không) → số
export function parseVndInput(str) {
  if (str == null || typeof str !== 'string') return 0
  const n = Number(str.replace(/\D/g, ''))
  return Number.isNaN(n) ? 0 : n
}
