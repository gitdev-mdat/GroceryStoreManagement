import { useState, useCallback } from 'react'

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2500)
  }, [])

  const ToastContainer = () => {
    if (toasts.length === 0) return null
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 pointer-events-none">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-lg"
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return { showToast, ToastContainer }
}
