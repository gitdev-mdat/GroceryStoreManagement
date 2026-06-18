import { useEffect } from 'react'

/**
 * Dialog xác nhận tái sử dụng.
 * @param {boolean} open - Hiển thị khi true
 * @param {() => void} onClose - Gọi khi đóng (Hủy / click overlay / Escape)
 * @param {() => void} onConfirm - Gọi khi bấm Xác nhận
 * @param {string} title - Tiêu đề dialog
 * @param {React.ReactNode} children - Nội dung (đoạn mô tả hoặc JSX)
 * @param {string} confirmLabel - Nhãn nút xác nhận (mặc định "Xác nhận")
 * @param {string} cancelLabel - Nhãn nút hủy (mặc định "Hủy")
 * @param {string} variant - 'default' | 'warning' (màu nhấn cho nút xác nhận)
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Xác nhận',
  children,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'default',
}) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="confirm-dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="confirm-dialog">
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h3>
        <div className="confirm-dialog-body">{children}</div>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={'btn btn-primary confirm-dialog-confirm confirm-dialog-confirm--' + variant}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
