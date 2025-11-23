import type { Point2D } from '../types'

/**
 * Calculate the magnitude (length) of a 2D vector
 */
export function vectorMagnitude(vector: Point2D): number {
  return Math.sqrt(vector[0] ** 2 + vector[1] ** 2)
}

/**
 * Normalize a 2D vector to unit length
 * Returns [0, 0] if the vector is zero or too small
 */
export function normalizeVector(vector: Point2D): Point2D {
  const magnitude = vectorMagnitude(vector)
  if (magnitude < 1e-10) {
    return [0, 0]
  }
  return [vector[0] / magnitude, vector[1] / magnitude]
}

/**
 * Check if two vectors are collinear (parallel or anti-parallel)
 * Uses the determinant (cross product) to check if vectors are parallel
 * @param v1 First vector
 * @param v2 Second vector
 * @param threshold Tolerance for considering vectors collinear (default: 1e-10)
 * @returns true if vectors are collinear
 */
export function areVectorsCollinear(v1: Point2D, v2: Point2D, threshold: number = 1e-10): boolean {
  // Calculate determinant (cross product magnitude)
  // For 2D vectors [a, b] and [c, d], determinant is a*d - b*c
  const determinant = Math.abs(v1[0] * v2[1] - v1[1] * v2[0])
  
  // If determinant is close to zero, vectors are collinear
  return determinant < threshold
}

