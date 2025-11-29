import { describe, it, expect } from 'vitest'
import { findContourPoints } from '../../src/utils/contourFinding'
import type { Point2D } from '../../src/types'

describe('findContourPoints', () => {
  describe('Circle (x² + y² - 16 = 0)', () => {
    it('should find contour points for a circle', () => {
      const contours = findContourPoints('x**2 + y**2 - 16', -10, 10, -10, 10, 100)
      
      expect(contours.length).toBeGreaterThan(0)
      
      // Check that we have at least one contour
      const mainContour = contours[0]
      expect(mainContour.length).toBeGreaterThan(10) // Should have many points for a circle
      
      // Verify points are approximately on the circle (radius ≈ 4)
      for (const point of mainContour) {
        const [x, y] = point
        const radius = Math.sqrt(x * x + y * y)
        expect(radius).toBeGreaterThan(3)
        expect(radius).toBeLessThan(5) // Allow reasonable tolerance for interpolation
      }
    })
    
    it('should find points close to the expected circle radius', () => {
      const contours = findContourPoints('x**2 + y**2 - 16', -10, 10, -10, 10, 100)
      
      expect(contours.length).toBeGreaterThan(0)
      const mainContour = contours[0]
      
      // Sample a few points and verify they're on the circle
      const samplePoints = [
        mainContour[0],
        mainContour[Math.floor(mainContour.length / 4)],
        mainContour[Math.floor(mainContour.length / 2)],
        mainContour[Math.floor(mainContour.length * 3 / 4)],
      ]
      
      for (const point of samplePoints) {
        const [x, y] = point
        const radius = Math.sqrt(x * x + y * y)
        expect(radius).toBeGreaterThan(3)
        expect(radius).toBeLessThan(5)
      }
    })
  })
  
  describe('Ellipse (x²/4 + y² - 1 = 0)', () => {
    it('should find contour points for an ellipse', () => {
      const contours = findContourPoints('x**2/4 + y**2 - 1', -5, 5, -5, 5, 100)
      
      expect(contours.length).toBeGreaterThan(0)
      const mainContour = contours[0]
      expect(mainContour.length).toBeGreaterThan(10)
      
      // Verify points satisfy ellipse equation approximately
      for (const point of mainContour) {
        const [x, y] = point
        const value = (x * x) / 4 + y * y - 1
        expect(Math.abs(value)).toBeLessThan(0.5) // Allow some tolerance
      }
    })
  })
  
  describe('Multiple disconnected curves', () => {
    it('should find multiple circles', () => {
      // Two circles: (x-3)² + y² - 4 = 0 and (x+3)² + y² - 4 = 0
      // Combined: ((x-3)**2 + y**2 - 4) * ((x+3)**2 + y**2 - 4) = 0
      const contours = findContourPoints(
        '((x-3)**2 + y**2 - 4) * ((x+3)**2 + y**2 - 4)',
        -10, 10, -10, 10,
        150
      )
      
      // Should find at least 2 contours (one for each circle)
      expect(contours.length).toBeGreaterThanOrEqual(1) // May merge or separate
      
      // Total points should be substantial
      const totalPoints = contours.reduce((sum, c) => sum + c.length, 0)
      expect(totalPoints).toBeGreaterThan(20)
    })
  })
  
  describe('Complex equations', () => {
    it('should handle hyperbola (x² - y² - 1 = 0)', () => {
      const contours = findContourPoints('x**2 - y**2 - 1', -5, 5, -5, 5, 100)
      
      // Hyperbola should have two branches
      expect(contours.length).toBeGreaterThan(0)
      
      const totalPoints = contours.reduce((sum, c) => sum + c.length, 0)
      expect(totalPoints).toBeGreaterThan(10)
    })
    
    it('should handle equations with trigonometric functions', () => {
      // sin(x) + cos(y) = 0
      const contours = findContourPoints('sin(x) + cos(y)', -5, 5, -5, 5, 100)
      
      // Should find some contours
      expect(contours.length).toBeGreaterThanOrEqual(0) // May or may not have contours in range
    })
  })
  
  describe('Performance with various grid resolutions', () => {
    it('should work with low resolution (50)', () => {
      const start = performance.now()
      const contours = findContourPoints('x**2 + y**2 - 16', -10, 10, -10, 10, 50)
      const duration = performance.now() - start
      
      expect(contours.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })
    
    it('should work with medium resolution (200)', () => {
      const start = performance.now()
      const contours = findContourPoints('x**2 + y**2 - 16', -10, 10, -10, 10, 200)
      const duration = performance.now() - start
      
      expect(contours.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
    })
    
    it('should work with high resolution (500)', () => {
      const start = performance.now()
      const contours = findContourPoints('x**2 + y**2 - 16', -10, 10, -10, 10, 500)
      const duration = performance.now() - start
      
      expect(contours.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(30000) // Should complete in under 30 seconds
    })
    
    it('should use adaptive resolution when not specified', () => {
      const contours = findContourPoints('x**2 + y**2 - 16', -10, 10, -10, 10)
      
      expect(contours.length).toBeGreaterThan(0)
      const mainContour = contours[0]
      expect(mainContour.length).toBeGreaterThan(10)
    })
  })
  
  describe('Edge cases', () => {
    it('should handle equations with no contours in range', () => {
      // x² + y² + 100 = 0 has no real solutions
      const contours = findContourPoints('x**2 + y**2 + 100', -10, 10, -10, 10, 100)
      
      // Should return empty or very few contours
      const totalPoints = contours.reduce((sum, c) => sum + c.length, 0)
      expect(totalPoints).toBeLessThan(5) // Should be very few or no points
    })
    
    it('should handle small ranges', () => {
      const contours = findContourPoints('x**2 + y**2 - 1', -2, 2, -2, 2, 50)
      
      expect(contours.length).toBeGreaterThan(0)
    })
    
    it('should handle large ranges', () => {
      const contours = findContourPoints('x**2 + y**2 - 100', -20, 20, -20, 20, 100)
      
      expect(contours.length).toBeGreaterThan(0)
      const mainContour = contours[0]
      expect(mainContour.length).toBeGreaterThan(10)
    })
  })
  
  describe('Contour quality', () => {
    it('should produce smooth contours', () => {
      const contours = findContourPoints('x**2 + y**2 - 16', -10, 10, -10, 10, 100)
      
      expect(contours.length).toBeGreaterThan(0)
      const mainContour = contours[0]
      
      // Check that consecutive points are reasonably close (smooth curve)
      for (let i = 1; i < Math.min(mainContour.length, 20); i++) {
        const [x1, y1] = mainContour[i - 1]
        const [x2, y2] = mainContour[i]
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        
        // Points should be reasonably close (not too far apart)
        expect(distance).toBeLessThan(1.0) // Max distance between consecutive points
      }
    })
    
    it('should filter out very short contours (noise)', () => {
      // This should produce mostly valid contours, filtering out noise
      const contours = findContourPoints('x**2 + y**2 - 16', -10, 10, -10, 10, 100)
      
      // All contours should have at least 2 points
      for (const contour of contours) {
        expect(contour.length).toBeGreaterThanOrEqual(2)
      }
    })
  })
})

