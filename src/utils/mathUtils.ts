import type { Point2D } from '../types'

/**
 * Clamp a number between min and max values
 * @param value Value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Linear interpolation between two values
 * @param start Start value
 * @param end End value
 * @param t Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

/**
 * Calculate distance between two 2D points
 * @param p1 First point [x, y]
 * @param p2 Second point [x, y]
 * @returns Distance between points
 */
export function distance2D(p1: Point2D, p2: Point2D): number {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate squared distance between two 2D points (faster, no sqrt)
 * Useful for distance comparisons where exact distance isn't needed
 * @param p1 First point [x, y]
 * @param p2 Second point [x, y]
 * @returns Squared distance between points
 */
export function distanceSquared2D(p1: Point2D, p2: Point2D): number {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  return dx * dx + dy * dy
}

/**
 * Clamp a point to stay within frame bounds
 * @param point Point to clamp [x, y]
 * @param minX Minimum x value
 * @param maxX Maximum x value
 * @param minY Minimum y value
 * @param maxY Maximum y value
 * @returns Clamped point [x, y]
 */
export function clampPoint(point: Point2D, minX: number, maxX: number, minY: number, maxY: number): Point2D {
  return [
    clamp(point[0], minX, maxX),
    clamp(point[1], minY, maxY)
  ]
}

