import type { CoordinateFrame, ViewportState, Point2D, ImplicitPlot } from '../types'
import {
  frameToScreen,
  nestedFrameToScreen,
} from './frameTransforms'
import { drawSmoothCurve } from './curveDrawing'
import { findContourPoints } from './contourFinding'

/**
 * Draw implicit plots defined in a frame
 * Implicit plots are curves where f(x, y) = 0
 */
export function drawFrameImplicitPlots(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
): void {
  if (!frame.implicitPlots || frame.implicitPlots.length === 0) {
    return
  }

  // Transform function for converting frame coordinates to screen coordinates
  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)
  
  // Calculate effective zoom level for adaptive gap detection
  // Higher zoom = more detail = allow larger gaps (points are closer in world space)
  const effectiveZoom = viewport.zoom * frame.viewport.zoom

  // Draw each implicit plot
  frame.implicitPlots.forEach((plot: ImplicitPlot) => {
    try {
      // Enable smoothing for implicit plots
      const oldSmoothing = ctx.imageSmoothingEnabled
      ctx.imageSmoothingEnabled = true
      
      ctx.strokeStyle = plot.color || '#3b82f6'
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      
      // If points are provided, use them directly (for pre-computed contours)
      if (plot.points && plot.points.length > 0) {
        drawImplicitFromPoints(ctx, plot, transformToScreen, effectiveZoom)
      } else if (plot.equation && plot.equation.length > 0) {
        // Find contours using marching squares algorithm
        drawImplicitFromExpression(ctx, plot, transformToScreen, effectiveZoom)
      } else {
        // Skip if no valid data
        console.warn('[drawFrameImplicitPlots] Skipping implicit plot with no points or equation:', plot)
      }
      
      ctx.stroke()
      ctx.globalAlpha = 1.0
      
      // Restore original smoothing setting
      ctx.imageSmoothingEnabled = oldSmoothing
    } catch (error) {
      // If drawing fails, skip this implicit plot
      console.warn('[drawFrameImplicitPlots] Failed to draw implicit plot:', plot.equation || 'points', error)
    }
  })
}

/**
 * Draw an implicit plot from pre-computed contour points
 */
function drawImplicitFromPoints(
  ctx: CanvasRenderingContext2D,
  plot: ImplicitPlot,
  transformToScreen: (point: Point2D) => Point2D,
  effectiveZoom: number = 1.0
): void {
  if (!plot.points || plot.points.length === 0) {
    return
  }

  // Sort points by proximity to form continuous curves
  // This helps when points come from Python in random order
  const sortedPoints = sortPointsByProximity(plot.points)

  // Draw all points as a continuous curve
  // Note: For implicit plots, points may represent multiple disconnected contours
  // We'll draw them as separate segments, breaking at NaN points or large gaps
  const screenPoints: Point2D[] = []
  // Make gap threshold zoom-aware: higher zoom = more detail = allow larger gaps
  // At zoom 1.0, use 30 pixels. At zoom 10.0, use 60 pixels (2x more tolerant)
  const baseGapThreshold = 30
  const maxScreenGap = baseGapThreshold * Math.max(1.0, Math.sqrt(effectiveZoom))
  
  for (let i = 0; i < sortedPoints.length; i++) {
    const point = sortedPoints[i]
    const [x, y] = point
    
    // Check for NaN separator points (used to mark contour boundaries)
    if (!isFinite(x) || !isFinite(y)) {
      // Break the curve at separator points
      if (screenPoints.length > 1) {
        drawSmoothCurve(ctx, screenPoints)
      }
      screenPoints.length = 0
      continue
    }
    
    const screen = transformToScreen([x, y])
    
    // Check for large gaps (disconnected contours)
    if (screenPoints.length > 0) {
      const prevScreen = screenPoints[screenPoints.length - 1]
      const screenDistance = Math.sqrt(
        (screen[0] - prevScreen[0]) ** 2 + (screen[1] - prevScreen[1]) ** 2
      )
      
      if (screenDistance > maxScreenGap) {
        // Large gap detected - break the curve and start a new segment
        if (screenPoints.length > 1) {
          drawSmoothCurve(ctx, screenPoints)
        }
        screenPoints.length = 0
      }
    }
    
    screenPoints.push(screen)
  }
  
  // Draw remaining points
  if (screenPoints.length > 1) {
    drawSmoothCurve(ctx, screenPoints)
  }
}

/**
 * Sort points by proximity to form continuous curves
 * Uses a greedy nearest-neighbor algorithm
 */
function sortPointsByProximity(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length <= 1) {
    return points
  }

  const sorted: Array<[number, number]> = []
  const remaining = new Set(points.map((_, i) => i))
  
  // Start with first point
  let currentIdx = 0
  remaining.delete(currentIdx)
  sorted.push(points[currentIdx])
  
  // Greedily find nearest neighbor
  while (remaining.size > 0) {
    let nearestIdx: number | null = null
    let minDist = Infinity
    
    const currentPoint = points[currentIdx]
    
    for (const idx of remaining) {
      const point = points[idx]
      const dist = Math.sqrt(
        (point[0] - currentPoint[0]) ** 2 + (point[1] - currentPoint[1]) ** 2
      )
      if (dist < minDist) {
        minDist = dist
        nearestIdx = idx
      }
    }
    
    if (nearestIdx !== null && minDist < Infinity) {
      sorted.push(points[nearestIdx])
      remaining.delete(nearestIdx)
      currentIdx = nearestIdx
    } else {
      // No nearby point found, start a new segment
      if (remaining.size > 0) {
        const nextValue = remaining.values().next().value
        if (nextValue !== undefined) {
          currentIdx = nextValue
          remaining.delete(currentIdx)
          sorted.push(points[currentIdx])
        }
      }
    }
  }
  
  return sorted
}

/**
 * Draw an implicit plot from an equation by finding contours
 */
function drawImplicitFromExpression(
  ctx: CanvasRenderingContext2D,
  plot: ImplicitPlot,
  transformToScreen: (point: Point2D) => Point2D
): void {
  const equation = plot.equation!
  const xMin = plot.xMin
  const xMax = plot.xMax
  const yMin = plot.yMin
  const yMax = plot.yMax
  
  // Calculate adaptive grid resolution based on range and zoom
  // Use the numPoints from plot if available, otherwise calculate adaptively
  const gridResolution = plot.numPoints ?? Math.max(50, Math.min(500, Math.round((xMax - xMin + yMax - yMin) / 2 * 50)))
  
  // Find contour points using marching squares
  console.log('[drawImplicitFromExpression] Finding contours for equation:', equation, 'range:', xMin, xMax, yMin, yMax, 'resolution:', gridResolution)
  let contours: Point2D[][]
  try {
    contours = findContourPoints(equation, xMin, xMax, yMin, yMax, gridResolution, 3)
    console.log('[drawImplicitFromExpression] Found', contours.length, 'contour segments with', contours.reduce((sum, c) => sum + c.length, 0), 'total points')
  } catch (error) {
    console.error('[drawImplicitFromExpression] Error finding contours:', error)
    return
  }
  
  // Draw each contour segment
  for (const contour of contours) {
    if (contour.length < 2) continue
    
    const screenPoints: Point2D[] = []
    
    for (const point of contour) {
      const [x, y] = point
      if (isFinite(x) && isFinite(y)) {
        const screen = transformToScreen([x, y])
        screenPoints.push(screen)
      } else {
        // Break the curve at invalid points
        if (screenPoints.length > 1) {
          drawSmoothCurve(ctx, screenPoints)
          screenPoints.length = 0
        }
      }
    }
    
    // Draw remaining points for this contour
    if (screenPoints.length > 1) {
      drawSmoothCurve(ctx, screenPoints)
    }
  }
}

