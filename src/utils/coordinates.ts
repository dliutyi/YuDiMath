import type { ViewportState, Point2D, FrameBounds } from '../types'
import { clampPoint } from './mathUtils'

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

/**
 * Check if a frame is completely contained within another frame's bounds
 * @param innerFrame Bounds of the inner frame (the one being checked)
 * @param outerFrame Bounds of the outer frame (the potential parent)
 * @returns true if innerFrame is completely inside outerFrame
 */
export function isFrameInsideFrame(innerFrame: FrameBounds, outerFrame: FrameBounds): boolean {
  const innerLeft = innerFrame.x
  const innerRight = innerFrame.x + innerFrame.width
  const innerTop = innerFrame.y + innerFrame.height
  const innerBottom = innerFrame.y

  const outerLeft = outerFrame.x
  const outerRight = outerFrame.x + outerFrame.width
  const outerTop = outerFrame.y + outerFrame.height
  const outerBottom = outerFrame.y

  // Check if inner frame is completely inside outer frame
  return (
    innerLeft >= outerLeft &&
    innerRight <= outerRight &&
    innerTop <= outerTop &&
    innerBottom >= outerBottom
  )
}

/**
 * Clamp a point to stay within frame bounds
 * @param point Point to clamp [x, y]
 * @param bounds Frame bounds to clamp to
 * @returns Clamped point [x, y]
 */
export function clampPointToFrameBounds(point: Point2D, bounds: FrameBounds): Point2D {
  const minX = bounds.x
  const maxX = bounds.x + bounds.width
  const minY = bounds.y
  const maxY = bounds.y + bounds.height

  return clampPoint(point, minX, maxX, minY, maxY)
}

/**
 * Check if a point is inside a frame's bounds
 * @param point Point to check [x, y] in world coordinates
 * @param bounds Frame bounds to check against
 * @returns true if point is inside the frame bounds
 */
export function isPointInFrame(point: Point2D, bounds: FrameBounds): boolean {
  const [x, y] = point
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  )
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param point Point to check [x, y]
 * @param polygon Array of polygon vertices in order (should form a closed polygon)
 * @returns true if point is inside the polygon
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  const [x, y] = point
  let inside = false
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) {
      inside = !inside
    }
  }
  
  return inside
}

