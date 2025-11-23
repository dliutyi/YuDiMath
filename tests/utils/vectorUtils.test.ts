import { describe, it, expect } from 'vitest'
import { vectorMagnitude, normalizeVector, areVectorsCollinear } from '../../src/utils/vectorUtils'
import type { Point2D } from '../../src/types'

describe('vectorUtils', () => {
  describe('vectorMagnitude', () => {
    it('calculates magnitude of a vector', () => {
      expect(vectorMagnitude([3, 4])).toBe(5)
      expect(vectorMagnitude([0, 0])).toBe(0)
      expect(vectorMagnitude([1, 0])).toBe(1)
      expect(vectorMagnitude([0, 1])).toBe(1)
    })

    it('handles negative components', () => {
      expect(vectorMagnitude([-3, -4])).toBe(5)
      expect(vectorMagnitude([-1, 0])).toBe(1)
    })
  })

  describe('normalizeVector', () => {
    it('normalizes a vector to unit length', () => {
      const normalized = normalizeVector([3, 4])
      expect(normalized[0]).toBeCloseTo(0.6, 5)
      expect(normalized[1]).toBeCloseTo(0.8, 5)
      expect(vectorMagnitude(normalized)).toBeCloseTo(1, 5)
    })

    it('normalizes unit vectors correctly', () => {
      const normalized = normalizeVector([1, 0])
      expect(normalized[0]).toBe(1)
      expect(normalized[1]).toBe(0)
    })

    it('returns [0, 0] for zero vector', () => {
      const normalized = normalizeVector([0, 0])
      expect(normalized[0]).toBe(0)
      expect(normalized[1]).toBe(0)
    })

    it('returns [0, 0] for very small vectors', () => {
      const normalized = normalizeVector([1e-11, 1e-11])
      expect(normalized[0]).toBe(0)
      expect(normalized[1]).toBe(0)
    })

    it('handles negative components', () => {
      const normalized = normalizeVector([-3, -4])
      expect(normalized[0]).toBeCloseTo(-0.6, 5)
      expect(normalized[1]).toBeCloseTo(-0.8, 5)
      expect(vectorMagnitude(normalized)).toBeCloseTo(1, 5)
    })
  })

  describe('areVectorsCollinear', () => {
    it('returns true for parallel vectors', () => {
      expect(areVectorsCollinear([1, 0], [2, 0])).toBe(true)
      expect(areVectorsCollinear([0, 1], [0, 3])).toBe(true)
      expect(areVectorsCollinear([1, 1], [2, 2])).toBe(true)
    })

    it('returns true for anti-parallel vectors', () => {
      expect(areVectorsCollinear([1, 0], [-2, 0])).toBe(true)
      expect(areVectorsCollinear([0, 1], [0, -3])).toBe(true)
    })

    it('returns false for non-parallel vectors', () => {
      expect(areVectorsCollinear([1, 0], [0, 1])).toBe(false)
      expect(areVectorsCollinear([1, 0], [1, 1])).toBe(false)
      expect(areVectorsCollinear([1, 1], [1, -1])).toBe(false)
    })

    it('returns true for zero vectors', () => {
      expect(areVectorsCollinear([0, 0], [0, 0])).toBe(true)
      expect(areVectorsCollinear([0, 0], [1, 0])).toBe(true)
      expect(areVectorsCollinear([1, 0], [0, 0])).toBe(true)
    })

    it('handles custom threshold', () => {
      // Vectors that are almost but not quite collinear
      const v1: Point2D = [1, 0]
      const v2: Point2D = [1, 0.0001]
      
      // With default threshold, should be false
      expect(areVectorsCollinear(v1, v2)).toBe(false)
      
      // With larger threshold, should be true
      expect(areVectorsCollinear(v1, v2, 0.01)).toBe(true)
    })
  })
})

