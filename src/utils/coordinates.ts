import type { ViewportState, Point2D } from '../types'

/**
 * Convert world coordinates to screen coordinates
 * @param x World x coordinate
 * @param y World y coordinate
 * @param viewport Current viewport state
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Screen coordinates [x, y]
 */
export function worldToScreen(
  x: number,
  y: number,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  // Center of canvas in screen coordinates
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2

  // Transform: translate by viewport offset, scale by zoom, then translate to center
  const screenX = centerX + (x - viewport.x) * viewport.zoom
  const screenY = centerY - (y - viewport.y) * viewport.zoom // Invert Y axis (screen Y increases downward)

  return [screenX, screenY]
}

/**
 * Convert screen coordinates to world coordinates
 * @param screenX Screen x coordinate
 * @param screenY Screen y coordinate
 * @param viewport Current viewport state
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns World coordinates [x, y]
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  // Center of canvas in screen coordinates
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2

  // Inverse transform: translate from center, scale by inverse zoom, then translate by viewport offset
  const worldX = viewport.x + (screenX - centerX) / viewport.zoom
  const worldY = viewport.y - (screenY - centerY) / viewport.zoom // Invert Y axis

  return [worldX, worldY]
}

/**
 * Snap a value to the nearest grid point
 * @param value Value to snap
 * @param gridStep Grid step size
 * @returns Snapped value
 */
export function snapToGrid(value: number, gridStep: number): number {
  if (gridStep <= 0) return value
  return Math.round(value / gridStep) * gridStep
}

/**
 * Snap a point to the nearest grid intersection
 * @param point Point to snap [x, y]
 * @param gridStep Grid step size
 * @returns Snapped point [x, y]
 */
export function snapPointToGrid(point: Point2D, gridStep: number): Point2D {
  return [snapToGrid(point[0], gridStep), snapToGrid(point[1], gridStep)]
}

/**
 * Calculate viewport transformation matrix
 * Returns transformation parameters for rendering
 * @param viewport Current viewport state
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Transformation parameters
 */
export function calculateViewportMatrix(
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
) {
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2

  return {
    centerX,
    centerY,
    scale: viewport.zoom,
    offsetX: viewport.x,
    offsetY: viewport.y,
  }
}

/**
 * Get the visible world bounds based on viewport and canvas size
 * @param viewport Current viewport state
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Visible bounds {minX, maxX, minY, maxY}
 */
export function getVisibleBounds(
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
) {
  const topLeft = screenToWorld(0, 0, viewport, canvasWidth, canvasHeight)
  const bottomRight = screenToWorld(
    canvasWidth,
    canvasHeight,
    viewport,
    canvasWidth,
    canvasHeight
  )

  return {
    minX: Math.min(topLeft[0], bottomRight[0]),
    maxX: Math.max(topLeft[0], bottomRight[0]),
    minY: Math.min(topLeft[1], bottomRight[1]),
    maxY: Math.max(topLeft[1], bottomRight[1]),
  }
}

