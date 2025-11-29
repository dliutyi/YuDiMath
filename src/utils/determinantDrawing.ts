import type { CoordinateFrame, ViewportState, Point2D, DeterminantFill } from '../types'
import {
  frameToScreen,
  nestedFrameToScreen,
} from './frameTransforms'

/**
 * Calculate the four vertices of the parallelogram formed by two vectors
 * The parallelogram is formed by:
 * - v0 = [0, 0] (origin)
 * - v1 = vector1
 * - v2 = vector1 + vector2
 * - v3 = vector2
 * 
 * @param vector1 First column vector
 * @param vector2 Second column vector
 * @returns Array of four vertices [v0, v1, v2, v3]
 */
export function calculateParallelogramVertices(
  vector1: Point2D,
  vector2: Point2D
): [Point2D, Point2D, Point2D, Point2D] {
  const v0: Point2D = [0, 0] // Origin
  const v1: Point2D = [vector1[0], vector1[1]] // vector1 endpoint
  const v2: Point2D = [vector1[0] + vector2[0], vector1[1] + vector2[1]] // vector1 + vector2
  const v3: Point2D = [vector2[0], vector2[1]] // vector2 endpoint
  
  return [v0, v1, v2, v3]
}

/**
 * Draw determinant fills defined in a frame
 * Determinant fills are drawn as filled parallelograms representing the area
 * of the determinant formed by two vectors
 */
export function drawFrameDeterminantFills(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
): void {
  if (!frame.determinantFills || frame.determinantFills.length === 0) {
    return
  }

  // Transform function for converting frame coordinates to screen coordinates
  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)

  // Draw each determinant fill
  frame.determinantFills.forEach((fill: DeterminantFill) => {
    try {
      // Calculate parallelogram vertices
      const [v0, v1, v2, v3] = calculateParallelogramVertices(fill.vector1, fill.vector2)
      
      // Transform vertices to screen coordinates
      const v0Screen = transformToScreen(v0)
      const v1Screen = transformToScreen(v1)
      const v2Screen = transformToScreen(v2)
      const v3Screen = transformToScreen(v3)
      
      // Draw filled parallelogram
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(v0Screen[0], v0Screen[1])
      ctx.lineTo(v1Screen[0], v1Screen[1])
      ctx.lineTo(v2Screen[0], v2Screen[1])
      ctx.lineTo(v3Screen[0], v3Screen[1])
      ctx.closePath()
      
      // Set fill color (with transparency)
      ctx.fillStyle = fill.color || '#3b82f680'
      ctx.fill()
      
      // Draw outline for clarity (optional, but helpful for visualization)
      ctx.strokeStyle = fill.color || '#3b82f6'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.8
      ctx.stroke()
      
      ctx.restore()
    } catch (error) {
      // If drawing fails, skip this determinant fill
      console.warn('[drawFrameDeterminantFills] Failed to draw determinant fill:', fill, error)
    }
  })
}

