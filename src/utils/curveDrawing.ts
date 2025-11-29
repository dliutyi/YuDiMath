import type { Point2D } from '../types'

/**
 * Draw a smooth curve through points using cubic Bezier curves
 * Uses proper Catmull-Rom to Bezier conversion for maximum smoothness
 */
export function drawSmoothCurve(ctx: CanvasRenderingContext2D, points: Point2D[]): void {
  if (points.length === 0) return
  if (points.length === 1) {
    ctx.moveTo(points[0][0], points[0][1])
    return
  }
  if (points.length === 2) {
    ctx.moveTo(points[0][0], points[0][1])
    ctx.lineTo(points[1][0], points[1][1])
    return
  }
  
  // Enable image smoothing for smoother curves
  const oldSmoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = true
  
  // Start at first point
  ctx.moveTo(points[0][0], points[0][1])
  
  // For each segment, calculate control points using Catmull-Rom spline
  // Convert Catmull-Rom to cubic Bezier control points
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1]
    
    // Catmull-Rom to Bezier conversion
    // Control point 1: 1/6 of the way from p1 toward p2, adjusted by (p2 - p0)
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    
    // Control point 2: 1/6 of the way from p2 toward p1, adjusted by (p3 - p1)
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    
    // Use cubic Bezier curve - don't round, let smoothing handle it
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1])
  }
  
  // Restore original smoothing setting
  ctx.imageSmoothingEnabled = oldSmoothing
}

