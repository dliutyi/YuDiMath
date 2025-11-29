import type { Point2D } from '../types'

export interface DiscontinuityCheckResult {
  isDiscontinuity: boolean
  shouldBreak: boolean
}

/**
 * Check if a point represents a discontinuity in a function plot
 * Uses conservative, zoom-aware thresholds to avoid false positives
 */
export function checkDiscontinuity(
  point: Point2D,
  pointScreen: Point2D,
  lastPoint: Point2D | null,
  lastScreen: Point2D | null,
  lastY: number | null,
  pixelsPerUnitAvg: number,
  xMin: number,
  xMax: number,
  numPoints: number
): DiscontinuityCheckResult {
  // Always break on invalid points (NaN, Infinity) - primary discontinuity indicator
  if (!isFinite(point[0]) || !isFinite(point[1])) {
    return { isDiscontinuity: true, shouldBreak: true }
  }

  // Only check for discontinuity if we have a previous point
  if (lastScreen === null || lastPoint === null || lastY === null) {
    return { isDiscontinuity: false, shouldBreak: false }
  }

  // World-space X distance (zoom-independent)
  const worldXDistance = Math.abs(point[0] - lastPoint[0])
  
  // Screen-space vertical jump (for vertical asymptotes)
  const dy = pointScreen[1] - lastScreen[1]
  const verticalJump = Math.abs(dy)
  
  // Very conservative zoom-aware thresholds that account for BOTH zoom levels
  // At high zoom (either frame or main), need even larger jumps to be considered discontinuities
  const MIN_VERTICAL_JUMP_PIXELS = Math.max(1000, pixelsPerUnitAvg * 10) // Very large vertical jumps only
  const MAX_X_DISTANCE_WORLD = (xMax - xMin) / numPoints * 20 // Large X gaps only
  
  // Ultra-conservative detection: only break on:
  // 1. Extremely large vertical jumps (clear vertical asymptotes) - zoom-aware
  // 2. Very large X gaps (sampling issues, not really discontinuities but should break)
  // 3. Sign change crossing zero with extremely large vertical jump (1/x at x=0)
  const hasExtremeVerticalJump = verticalJump > MIN_VERTICAL_JUMP_PIXELS
  const hasVeryLargeXGap = worldXDistance > MAX_X_DISTANCE_WORLD
  const signChange = (lastY < 0 && point[1] > 0) || (lastY > 0 && point[1] < 0)
  const crossesZero = (lastPoint[0] < 0 && point[0] > 0) || (lastPoint[0] > 0 && point[0] < 0)
  const hasSignChangeAtZero = signChange && crossesZero && verticalJump > MIN_VERTICAL_JUMP_PIXELS * 0.8
  
  // Only break on extremely clear discontinuities
  // Removed relative jump detection entirely - it was causing false positives on high-frequency functions
  if (hasExtremeVerticalJump || hasVeryLargeXGap || hasSignChangeAtZero) {
    return { isDiscontinuity: true, shouldBreak: true }
  }

  return { isDiscontinuity: false, shouldBreak: false }
}

/**
 * Calculate pixels per unit for zoom-aware discontinuity detection
 */
export function calculatePixelsPerUnit(
  transformToScreen: (point: Point2D) => Point2D
): number {
  const originScreen = transformToScreen([0, 0])
  const oneUnitScreen = transformToScreen([1, 0])
  const pixelsPerUnit = Math.abs(oneUnitScreen[0] - originScreen[0])
  
  // Also calculate pixels per unit in Y direction (for vertical jumps)
  const oneUnitYScreen = transformToScreen([0, 1])
  const pixelsPerUnitY = Math.abs(oneUnitYScreen[1] - originScreen[1])
  const pixelsPerUnitAvg = (pixelsPerUnit + pixelsPerUnitY) / 2
  
  return pixelsPerUnitAvg
}

