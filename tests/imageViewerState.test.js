import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DOUBLE_TAP_IMAGE_SCALE,
  MAX_IMAGE_SCALE,
  constrainImageView,
  panImageView,
  pinchImageView,
  resetImageView,
  toggleImageZoom,
  zoomImageView,
} from '../src/lib/imageViewerState.js'

const geometry = { imageWidth: 600, imageHeight: 800, viewportWidth: 600, viewportHeight: 800 }

test('viewer opens and resets to a centered fit view', () => {
  assert.deepEqual(resetImageView(), { scale: 1, x: 0, y: 0 })
  assert.deepEqual(constrainImageView({ scale: 1, x: 500, y: -500 }, geometry), resetImageView())
})

test('zoom preserves the focal point and never exceeds the supported range', () => {
  const zoomed = zoomImageView(resetImageView(), 2, { x: 100, y: 120 }, geometry)
  assert.deepEqual(zoomed, { scale: 2, x: -100, y: -120 })
  assert.equal(zoomImageView(zoomed, 99, { x: 0, y: 0 }, geometry).scale, MAX_IMAGE_SCALE)
})

test('pan is constrained so a zoomed image cannot be lost off-screen', () => {
  const zoomed = zoomImageView(resetImageView(), 2, { x: 0, y: 0 }, geometry)
  assert.deepEqual(panImageView(zoomed, { x: 2000, y: -2000 }, geometry), { scale: 2, x: 300, y: -400 })
})

test('double tap toggles between useful zoom and exact reset', () => {
  const zoomed = toggleImageZoom(resetImageView(), { x: 0, y: 0 }, geometry)
  assert.equal(zoomed.scale, DOUBLE_TAP_IMAGE_SCALE)
  assert.deepEqual(toggleImageZoom(zoomed, { x: 50, y: 50 }, geometry), resetImageView())
})

test('pinch distance and midpoint movement zoom and pan around the two-finger gesture', () => {
  const pinched = pinchImageView(
    resetImageView(),
    [{ x: -50, y: 0 }, { x: 50, y: 0 }],
    [{ x: -80, y: 20 }, { x: 120, y: 20 }],
    geometry,
  )
  assert.deepEqual(pinched, { scale: 2, x: 20, y: 20 })
})

test('a fresh image view starts clean instead of inheriting the previous image transform', () => {
  const firstImage = panImageView(zoomImageView(resetImageView(), 3, { x: 0, y: 0 }, geometry), { x: 120, y: -80 }, geometry)
  assert.notDeepEqual(firstImage, resetImageView())
  const secondImage = resetImageView()
  assert.deepEqual(secondImage, { scale: 1, x: 0, y: 0 })
})
