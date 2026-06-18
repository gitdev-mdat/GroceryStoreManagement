import { formatVndInputDisplay, parseVndInput } from './FormatNumber'

/**
 * Ô nhập số tiền VND: khi gõ hiển thị có dấu chấm (1.500.000), không làm tròn.
 * value = số (number), onChange nhận số. Làm tròn nghìn chỉ khi lưu/ghi sổ.
 */
export default function VndInput({ value, onChange, placeholder = '0', className = '', ...props }) {
  const num = value == null ? 0 : Number(value)
  const display = formatVndInputDisplay(num)

  const handleChange = (e) => {
    const next = parseVndInput(e.target.value)
    onChange(next)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={`input-base text-left ${className}`}
      {...props}
    />
  )
}
