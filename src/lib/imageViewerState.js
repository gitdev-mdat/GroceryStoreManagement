export const MIN_IMAGE_SCALE = 1
export const MAX_IMAGE_SCALE = 5
export const DOUBLE_TAP_IMAGE_SCALE = 2.5

export function resetImageView() {
  return { scale: MIN_IMAGE_SCALE, x: 0, y: 0 }
}

export function clampImageScale(scale) {
  return Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, scale))
}

export function getImagePanBounds(scale, geometry) {
  const { imageWidth = 0, imageHeight = 0, viewportWidth = 0, viewportHeight = 0 } = geometry || {}
  return {
    x: Math.max(0, ((imageWidth * scale) - viewportWidth) / 2),
    y: Math.max(0, ((imageHeight * scale) - viewportHeight) / 2),
  }
}

export function constrainImageView(view, geometry) {
  const scale = clampImageScale(view.scale)
  if (scale === MIN_IMAGE_SCALE) return resetImageView()

  const bounds = getImagePanBounds(scale, geometry)
  return {
    scale,
    x: Math.min(bounds.x, Math.max(-bounds.x, view.x)),
    y: Math.min(bounds.y, Math.max(-bounds.y, view.y)),
  }
}

export function zoomImageView(view, nextScale, focalPoint, geometry) {
  const scale = clampImageScale(nextScale)
  if (scale === MIN_IMAGE_SCALE) return resetImageView()

  const ratio = scale / view.scale
  const focal = focalPoint || { x: 0, y: 0 }
  return constrainImageView({
    scale,
    x: focal.x - ((focal.x - view.x) * ratio),
    y: focal.y - ((focal.y - view.y) * ratio),
  }, geometry)
}

export function panImageView(view, delta, geometry) {
  if (view.scale === MIN_IMAGE_SCALE) return resetImageView()
  return constrainImageView({
    ...view,
    x: view.x + delta.x,
    y: view.y + delta.y,
  }, geometry)
}

export function toggleImageZoom(view, focalPoint, geometry) {
  const nextScale = view.scale > MIN_IMAGE_SCALE ? MIN_IMAGE_SCALE : DOUBLE_TAP_IMAGE_SCALE
  return zoomImageView(view, nextScale, focalPoint, geometry)
}

export function pinchImageView(view, previousPoints, nextPoints, geometry) {
  if (previousPoints?.length !== 2 || nextPoints?.length !== 2) return view
  const previousDistance = Math.hypot(previousPoints[0].x - previousPoints[1].x, previousPoints[0].y - previousPoints[1].y)
  const nextDistance = Math.hypot(nextPoints[0].x - nextPoints[1].x, nextPoints[0].y - nextPoints[1].y)
  if (!previousDistance || !nextDistance) return view

  const previousCenter = {
    x: (previousPoints[0].x + previousPoints[1].x) / 2,
    y: (previousPoints[0].y + previousPoints[1].y) / 2,
  }
  const nextCenter = {
    x: (nextPoints[0].x + nextPoints[1].x) / 2,
    y: (nextPoints[0].y + nextPoints[1].y) / 2,
  }
  const scale = clampImageScale(view.scale * (nextDistance / previousDistance))
  const ratio = scale / view.scale
  return constrainImageView({
    scale,
    x: nextCenter.x - ((previousCenter.x - view.x) * ratio),
    y: nextCenter.y - ((previousCenter.y - view.y) * ratio),
  }, geometry)
}
