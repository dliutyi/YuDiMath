import { describe, it, expect } from 'vitest'
import {
  worldToScreen,
  screenToWorld,
  snapToGrid,
  snapPointToGrid,
  calculateViewportMatrix,
  getVisibleBounds,
} from '../../src/utils/coordinates'
import type { ViewportState } from '../../src/types'

describe('Coordinate Transformation Utilities', () => {
  const defaultViewport: ViewportState = {
    x: 0,
    y: 0,
    zoom: 1.0,
    gridStep: 1,
  }

  const canvasWidth = 800
  const canvasHeight = 600

  describe('worldToScreen', () => {
    it('converts world origin to screen center', () => {
      const [screenX, screenY] = worldToScreen(
        0,
        0,
        defaultViewport,
        canvasWidth,
        canvasHeight
      )
      expect(screenX).toBe(canvasWidth / 2)
      expect(screenY).toBe(canvasHeight / 2)
    })

    it('converts world coordinates with viewport offset', () => {
      const viewport: ViewportState = {
        x: 10,
        y: 20,
        zoom: 1.0,
        gridStep: 1,
      }
      const [screenX, screenY] = worldToScreen(
        10,
        20,
        viewport,
        canvasWidth,
        canvasHeight
      )
      expect(screenX).toBe(canvasWidth / 2)
      expect(screenY).toBe(canvasHeight / 2)
    })

    it('applies zoom transformation', () => {
      const viewport: ViewportState = {
        x: 0,
        y: 0,
        zoom: 2.0,
        gridStep: 1,
      }
      const [screenX, screenY] = worldToScreen(
        100,
        100,
        viewport,
        canvasWidth,
        canvasHeight
      )
      expect(screenX).toBe(canvasWidth / 2 + 200) // 100 * 2
      expect(screenY).toBe(canvasHeight / 2 - 200) // Inverted Y
    })

    it('handles negative world coordinates', () => {
      const [screenX, screenY] = worldToScreen(
        -50,
        -50,
        defaultViewport,
        canvasWidth,
        canvasHeight
      )
      expect(screenX).toBe(canvasWidth / 2 - 50)
      expect(screenY).toBe(canvasHeight / 2 + 50) // Inverted Y
    })

    it('handles zero zoom', () => {
      const viewport: ViewportState = {
        x: 0,
        y: 0,
        zoom: 0.1,
        gridStep: 1,
      }
      const [screenX, screenY] = worldToScreen(
        100,
        100,
        viewport,
        canvasWidth,
        canvasHeight
      )
      expect(screenX).toBeCloseTo(canvasWidth / 2 + 10)
      expect(screenY).toBeCloseTo(canvasHeight / 2 - 10)
    })
  })

  describe('screenToWorld', () => {
    it('converts screen center to world origin', () => {
      const [worldX, worldY] = screenToWorld(
        canvasWidth / 2,
        canvasHeight / 2,
        defaultViewport,
        canvasWidth,
        canvasHeight
      )
      expect(worldX).toBe(0)
      expect(worldY).toBe(0)
    })

    it('converts screen coordinates with viewport offset', () => {
      const viewport: ViewportState = {
        x: 10,
        y: 20,
        zoom: 1.0,
        gridStep: 1,
      }
      const [worldX, worldY] = screenToWorld(
        canvasWidth / 2,
        canvasHeight / 2,
        viewport,
        canvasWidth,
        canvasHeight
      )
      expect(worldX).toBe(10)
      expect(worldY).toBe(20)
    })

    it('applies inverse zoom transformation', () => {
      const viewport: ViewportState = {
        x: 0,
        y: 0,
        zoom: 2.0,
        gridStep: 1,
      }
      const [worldX, worldY] = screenToWorld(
        canvasWidth / 2 + 200,
        canvasHeight / 2 - 200,
        viewport,
        canvasWidth,
        canvasHeight
      )
      expect(worldX).toBe(100)
      expect(worldY).toBe(100)
    })

    it('handles negative screen coordinates', () => {
      const [worldX, worldY] = screenToWorld(
        0,
        0,
        defaultViewport,
        canvasWidth,
        canvasHeight
      )
      expect(worldX).toBe(-canvasWidth / 2)
      expect(worldY).toBe(canvasHeight / 2) // Inverted Y
    })

    it('round-trip conversion maintains accuracy', () => {
      const worldPoint: [number, number] = [123.45, -67.89]
      const screenPoint = worldToScreen(
        worldPoint[0],
        worldPoint[1],
        defaultViewport,
        canvasWidth,
        canvasHeight
      )
      const backToWorld = screenToWorld(
        screenPoint[0],
        screenPoint[1],
        defaultViewport,
        canvasWidth,
        canvasHeight
      )
      expect(backToWorld[0]).toBeCloseTo(worldPoint[0], 10)
      expect(backToWorld[1]).toBeCloseTo(worldPoint[1], 10)
    })
  })

  describe('snapToGrid', () => {
    it('snaps to nearest grid point with step 1', () => {
      expect(snapToGrid(0.3, 1)).toBe(0)
      expect(snapToGrid(0.7, 1)).toBe(1)
      expect(snapToGrid(1.5, 1)).toBe(2)
      expect(snapToGrid(-0.3, 1)).toBeCloseTo(0) // Handle -0 vs +0
      expect(snapToGrid(-0.7, 1)).toBe(-1)
    })

    it('snaps to nearest grid point with step 0.5', () => {
      expect(snapToGrid(0.2, 0.5)).toBe(0)
      expect(snapToGrid(0.3, 0.5)).toBe(0.5)
      expect(snapToGrid(1.2, 0.5)).toBe(1.0)
      expect(snapToGrid(1.3, 0.5)).toBe(1.5)
    })

    it('snaps to nearest grid point with step 5', () => {
      expect(snapToGrid(2, 5)).toBe(0)
      expect(snapToGrid(3, 5)).toBe(5)
      expect(snapToGrid(7, 5)).toBe(5)
      expect(snapToGrid(8, 5)).toBe(10)
    })

    it('handles zero grid step', () => {
      expect(snapToGrid(5.5, 0)).toBe(5.5)
      expect(snapToGrid(-3.2, 0)).toBe(-3.2)
    })

    it('handles negative grid step', () => {
      expect(snapToGrid(5.5, -1)).toBe(5.5)
    })

    it('handles exact grid points', () => {
      expect(snapToGrid(0, 1)).toBe(0)
      expect(snapToGrid(5, 5)).toBe(5)
      expect(snapToGrid(10, 2)).toBe(10)
    })
  })

  describe('snapPointToGrid', () => {
    it('snaps both coordinates to grid', () => {
      const point: [number, number] = [1.3, 2.7]
      const snapped = snapPointToGrid(point, 1)
      expect(snapped[0]).toBe(1)
      expect(snapped[1]).toBe(3)
    })

    it('handles negative coordinates', () => {
      const point: [number, number] = [-1.3, -2.7]
      const snapped = snapPointToGrid(point, 1)
      expect(snapped[0]).toBe(-1)
      expect(snapped[1]).toBe(-3)
    })

    it('works with different grid steps', () => {
      const point: [number, number] = [1.3, 2.7]
      const snapped = snapPointToGrid(point, 0.5)
      expect(snapped[0]).toBe(1.5)
      expect(snapped[1]).toBe(2.5)
    })
  })

  describe('calculateViewportMatrix', () => {
    it('calculates correct transformation parameters', () => {
      const viewport: ViewportState = {
        x: 10,
        y: 20,
        zoom: 2.0,
        gridStep: 1,
      }
      const matrix = calculateViewportMatrix(viewport, canvasWidth, canvasHeight)

      expect(matrix.centerX).toBe(canvasWidth / 2)
      expect(matrix.centerY).toBe(canvasHeight / 2)
      expect(matrix.scale).toBe(2.0)
      expect(matrix.offsetX).toBe(10)
      expect(matrix.offsetY).toBe(20)
    })

    it('handles different canvas sizes', () => {
      const matrix = calculateViewportMatrix(
        defaultViewport,
        1920,
        1080
      )
      expect(matrix.centerX).toBe(960)
      expect(matrix.centerY).toBe(540)
    })
  })

  describe('getVisibleBounds', () => {
    it('calculates visible bounds for centered viewport', () => {
      const bounds = getVisibleBounds(
        defaultViewport,
        canvasWidth,
        canvasHeight
      )
      expect(bounds.minX).toBeLessThan(0)
      expect(bounds.maxX).toBeGreaterThan(0)
      expect(bounds.minY).toBeLessThan(0)
      expect(bounds.maxY).toBeGreaterThan(0)
    })

    it('calculates visible bounds with viewport offset', () => {
      const viewport: ViewportState = {
        x: 100,
        y: 50,
        zoom: 1.0,
        gridStep: 1,
      }
      const bounds = getVisibleBounds(viewport, canvasWidth, canvasHeight)
      expect(bounds.minX).toBeLessThan(100)
      expect(bounds.maxX).toBeGreaterThan(100)
      expect(bounds.minY).toBeLessThan(50)
      expect(bounds.maxY).toBeGreaterThan(50)
    })

    it('calculates visible bounds with zoom', () => {
      const viewport: ViewportState = {
        x: 0,
        y: 0,
        zoom: 2.0,
        gridStep: 1,
      }
      const bounds = getVisibleBounds(viewport, canvasWidth, canvasHeight)
      // With zoom 2.0, visible area should be half the size
      const widthAtZoom1 = bounds.maxX - bounds.minX
      const viewport2: ViewportState = {
        x: 0,
        y: 0,
        zoom: 1.0,
        gridStep: 1,
      }
      const bounds2 = getVisibleBounds(viewport2, canvasWidth, canvasHeight)
      const widthAtZoom2 = bounds2.maxX - bounds2.minX
      expect(widthAtZoom1).toBeCloseTo(widthAtZoom2 / 2, 1)
    })
  })
})

