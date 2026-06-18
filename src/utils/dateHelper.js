export function formatToInputDate(dateStr) {
  if (!dateStr) return ''
  const parts = String(dateStr).split('/')
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0')
    const month = parts[1].padStart(2, '0')
    const year = parts[2]
    return `${year}-${month}-${day}`
  }
  return dateStr
}
