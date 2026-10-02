import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MAX_IMAGE_SCALE,
  MIN_IMAGE_SCALE,
  constrainImageView,
  panImageView,
  pinchImageView,
  resetImageView,
  toggleImageZoom,
  zoomImageView,
} from '../lib/imageViewerState'

function ViewerButton({ children, label, onClick, disabled = false, className = '', buttonRef }) {
  return (
    <button
      type="button"
      ref={buttonRef}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
    >
      {children}
    </button>
  )
}

export default function ZoomableImageViewer({ imageUrl, onClose }) {
  const stageRef = useRef(null)
  const imageRef = useRef(null)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const pointersRef = useRef(new Map())
  const viewRef = useRef(resetImageView())
  const touchGestureRef = useRef(null)
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 })
  const lastTouchToggleAtRef = useRef(0)
  const frameRef = useRef(null)
  const [scale, setScale] = useState(MIN_IMAGE_SCALE)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const geometry = useCallback(() => ({
    imageWidth: imageRef.current?.offsetWidth || 0,
    imageHeight: imageRef.current?.offsetHeight || 0,
    viewportWidth: stageRef.current?.clientWidth || 0,
    viewportHeight: stageRef.current?.clientHeight || 0,
  }), [])

  const paintView = useCallback((view) => {
    viewRef.current = view
    setScale(view.scale)
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      if (imageRef.current) {
        imageRef.current.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
      }
    })
  }, [])

  const reset = useCallback(() => {
    pointersRef.current.clear()
    setDragging(false)
    paintView(resetImageView())
  }, [paintView])

  const pointFromClient = useCallback((clientX, clientY) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: clientX - rect.left - (rect.width / 2), y: clientY - rect.top - (rect.height / 2) }
  }, [])

  const zoomAt = useCallback((nextScale, clientX, clientY) => {
    paintView(zoomImageView(viewRef.current, nextScale, pointFromClient(clientX, clientY), geometry()))
  }, [geometry, paintView, pointFromClient])

  const toggleAt = useCallback((clientX, clientY) => {
    paintView(toggleImageZoom(viewRef.current, pointFromClient(clientX, clientY), geometry()))
  }, [geometry, paintView, pointFromClient])

  useEffect(() => {
    if (!imageUrl) return undefined
    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled])') || [])
        .filter(element => element.offsetParent !== null)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const handleResize = () => paintView(constrainImageView(viewRef.current, geometry()))
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
      document.body.style.overflow = previousOverflow
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      previouslyFocused?.focus?.()
    }
  }, [geometry, imageUrl, onClose, paintView])

  useEffect(() => {
    setLoading(true)
    setFailed(false)
    setRetryNonce(0)
    reset()
  }, [imageUrl, reset])

  useEffect(() => {
    const image = imageRef.current
    if (!image?.complete) return
    if (image.naturalWidth > 0) {
      setLoading(false)
      setFailed(false)
      reset()
    } else {
      setLoading(false)
      setFailed(true)
    }
  }, [imageUrl, retryNonce, reset])

  if (!imageUrl) return null

  const handleWheel = (event) => {
    event.preventDefault()
    const factor = Math.exp(-event.deltaY * 0.0015)
    zoomAt(viewRef.current.scale * factor, event.clientX, event.clientY)
  }

  const handlePointerDown = (event) => {
    if (failed) return
    if (event.target.closest?.('button')) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 1) {
      touchGestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
      if (viewRef.current.scale > MIN_IMAGE_SCALE) setDragging(true)
    } else {
      if (touchGestureRef.current) touchGestureRef.current.moved = true
      setDragging(true)
    }
  }

  const handlePointerMove = (event) => {
    const previous = pointersRef.current.get(event.pointerId)
    if (!previous) return
    event.preventDefault()
    const before = Array.from(pointersRef.current.values())
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const after = Array.from(pointersRef.current.values())

    if (touchGestureRef.current && Math.hypot(event.clientX - touchGestureRef.current.x, event.clientY - touchGestureRef.current.y) > 8) {
      touchGestureRef.current.moved = true
    }

    if (after.length === 1) {
      paintView(panImageView(viewRef.current, { x: event.clientX - previous.x, y: event.clientY - previous.y }, geometry()))
      return
    }

    if (after.length === 2) {
      paintView(pinchImageView(
        viewRef.current,
        before.map(point => pointFromClient(point.x, point.y)),
        after.map(point => pointFromClient(point.x, point.y)),
        geometry(),
      ))
    }
  }

  const handlePointerEnd = (event) => {
    const gesture = touchGestureRef.current
    const wasSinglePointer = pointersRef.current.size === 1
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size === 0) setDragging(false)

    if (event.pointerType === 'touch' && wasSinglePointer && gesture?.pointerId === event.pointerId && !gesture.moved) {
      const now = Date.now()
      const previousTap = lastTapRef.current
      if (now - previousTap.time < 320 && Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) < 28) {
        toggleAt(event.clientX, event.clientY)
        lastTouchToggleAtRef.current = now
        lastTapRef.current = { time: 0, x: 0, y: 0 }
      } else {
        lastTapRef.current = { time: now, x: event.clientX, y: event.clientY }
      }
    }
    if (pointersRef.current.size === 0) touchGestureRef.current = null
  }

  const zoomFromCenter = (nextScale) => {
    const rect = stageRef.current?.getBoundingClientRect()
    zoomAt(nextScale, rect ? rect.left + (rect.width / 2) : 0, rect ? rect.top + (rect.height / 2) : 0)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Xem ảnh hóa đơn" className="flex h-[calc(100dvh-1rem)] max-h-[960px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl sm:h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Ảnh hóa đơn</div>
            <div className="hidden text-xs text-white/55 sm:block">Cuộn hoặc dùng 2 ngón tay để phóng to · Kéo để di chuyển</div>
          </div>
          <div className="flex items-center gap-1.5">
            <ViewerButton label="Thu nhỏ ảnh" disabled={scale <= MIN_IMAGE_SCALE} onClick={() => zoomFromCenter(scale - 0.5)} className="w-9 px-0 text-lg">−</ViewerButton>
            <output aria-live="polite" className="w-12 text-center text-xs tabular-nums text-white/70">{Math.round(scale * 100)}%</output>
            <ViewerButton label="Phóng to ảnh" disabled={scale >= MAX_IMAGE_SCALE} onClick={() => zoomFromCenter(scale + 0.5)} className="w-9 px-0 text-lg">+</ViewerButton>
            <ViewerButton label="Đặt lại ảnh" disabled={scale === MIN_IMAGE_SCALE} onClick={reset} className="hidden sm:inline-flex">Đặt lại</ViewerButton>
            <ViewerButton buttonRef={closeButtonRef} label="Đóng trình xem ảnh" onClick={onClose} className="border-white/25 bg-white/15" >Đóng</ViewerButton>
          </div>
        </div>

        <div
          ref={stageRef}
          className={`relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden bg-black ${dragging ? 'cursor-grabbing' : scale > MIN_IMAGE_SCALE ? 'cursor-grab' : 'cursor-zoom-in'}`}
          style={{ touchAction: 'none' }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onDoubleClick={(event) => {
            if (Date.now() - lastTouchToggleAtRef.current > 500) toggleAt(event.clientX, event.clientY)
          }}
        >
          {loading && !failed && <div className="absolute text-sm text-white/60">Đang tải ảnh hóa đơn…</div>}
          {failed ? (
            <div className="mx-6 rounded-xl border border-white/15 bg-white/5 p-6 text-center">
              <div className="font-semibold text-white">Không thể tải ảnh hóa đơn</div>
              <p className="mt-1 text-sm text-white/55">Ảnh có thể đã hết hạn hoặc không còn khả dụng.</p>
              <ViewerButton label="Thử tải lại ảnh" onClick={() => { setFailed(false); setLoading(true); setRetryNonce(value => value + 1) }} className="mt-4">Thử lại</ViewerButton>
            </div>
          ) : (
            <img
              key={`${imageUrl}-${retryNonce}`}
              ref={imageRef}
              src={imageUrl}
              alt="Ảnh hóa đơn"
              draggable="false"
              className={`max-h-full max-w-full object-contain will-change-transform ${loading ? 'opacity-0' : 'opacity-100'}`}
              style={{ transformOrigin: 'center center' }}
              onLoad={() => { setLoading(false); setFailed(false); reset() }}
              onError={() => { setLoading(false); setFailed(true) }}
            />
          )}
          {!loading && !failed && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-center text-[11px] text-white/70 shadow sm:hidden">
              Chụm 2 ngón tay để phóng to · Chạm đúp để đặt lại
            </div>
          )}
          {scale > MIN_IMAGE_SCALE && (
            <button type="button" onClick={(event) => { event.stopPropagation(); reset() }} className="absolute bottom-3 right-3 min-h-9 rounded-lg border border-white/20 bg-black/70 px-3 text-xs font-semibold text-white shadow sm:hidden">
              Đặt lại
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
