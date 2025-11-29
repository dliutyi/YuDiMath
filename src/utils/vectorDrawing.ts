import type { CoordinateFrame, ViewportState, Point2D, Vector } from '../types'
import { drawArrow } from '../utils/arrows'
import {
  frameToScreen,
  nestedFrameToScreen,
} from './frameTransforms'

/**
 * Draw vectors defined in a frame
 * Vectors are drawn in frame coordinates and transformed to screen coordinates
 */
export function drawFrameVectors(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
): void {
  if (!frame.vectors || frame.vectors.length === 0) {
    return
  }

  // Transform function for converting frame coordinates to screen coordinates
  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)

  // Draw each vector as an arrow
  frame.vectors.forEach((vector: Vector) => {
    const startScreen = transformToScreen(vector.start)
    const endScreen = transformToScreen(vector.end)
    
    // Calculate vector magnitude for arrow size scaling (optional)
    const dx = vector.end[0] - vector.start[0]
    const dy = vector.end[1] - vector.start[1]
    const magnitude = Math.sqrt(dx * dx + dy * dy)
    
    // Scale arrowhead size based on vector magnitude (min 6px, max 12px)
    // For very small vectors, use fixed size; for larger vectors, scale proportionally
    const baseArrowSize = 8
    const arrowSize = magnitude < 0.1 
      ? baseArrowSize 
      : Math.min(12, Math.max(6, baseArrowSize * (1 + magnitude * 0.1)))
    
    drawArrow(ctx, startScreen, endScreen, vector.color, 2, arrowSize)
  })
}

