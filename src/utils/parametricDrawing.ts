import type { CoordinateFrame, ViewportState, Point2D, ParametricPlot } from '../types'
import {
  frameToScreen,
  nestedFrameToScreen,
} from './frameTransforms'
import { drawSmoothCurve } from './curveDrawing'
import { checkDiscontinuity, calculatePixelsPerUnit } from './discontinuityDetection'
import { evaluateParametricExpression } from './expressionEvaluator'

/**
 * Draw parametric plots defined in a frame
 * Parametric plots are curves where x and y are functions of parameter t
 */
export function drawFrameParametricPlots(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
): void {
  if (!frame.parametricPlots || frame.parametricPlots.length === 0) {
    return
  }

  // Transform function for converting frame coordinates to screen coordinates
  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)

  // Draw each parametric plot
  frame.parametricPlots.forEach((plot: ParametricPlot) => {
    try {
      // Enable smoothing for parametric plots
      const oldSmoothing = ctx.imageSmoothingEnabled
      ctx.imageSmoothingEnabled = true
      
      ctx.strokeStyle = plot.color
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      
      // If points are provided, use them directly (for callable functions evaluated in Python)
      if (plot.points && plot.points.length > 0) {
        drawParametricFromPoints(ctx, plot, transformToScreen, frame, viewport, canvasWidth, canvasHeight)
      } else if (plot.xFunc && plot.yFunc) {
        // Evaluate string expressions
        drawParametricFromExpressions(ctx, plot, transformToScreen, frame, viewport, canvasWidth, canvasHeight)
      }
      
      ctx.stroke()
      ctx.globalAlpha = 1.0
      
      // Restore original smoothing setting
      ctx.imageSmoothingEnabled = oldSmoothing
    } catch (error) {
      // If drawing fails, skip this parametric plot
      console.warn('[drawFrameParametricPlots] Failed to draw parametric plot:', plot.xFunc || 'points', error)
    }
  })
}

/**
 * Draw a parametric plot from pre-computed points with discontinuity detection
 */
function drawParametricFromPoints(
  ctx: CanvasRenderingContext2D,
  plot: ParametricPlot,
  transformToScreen: (point: Point2D) => Point2D,
  _frame: CoordinateFrame,
  _viewport: ViewportState,
  _canvasWidth: number,
  _canvasHeight: number
): void {
  if (!plot.points || plot.points.length === 0) {
    return
  }

  const pixelsPerUnit = calculatePixelsPerUnit(transformToScreen)
  const validPoints: Array<{ point: Point2D; screen: Point2D }> = []

  // Transform points to screen coordinates and check for discontinuities
  for (let i = 0; i < plot.points.length; i++) {
    const [x, y] = plot.points[i]
    
    // Check for invalid values
    if (!isFinite(x) || !isFinite(y)) {
      // Break the path at discontinuities
      if (validPoints.length > 0) {
        drawSmoothCurve(ctx, validPoints.map(p => p.screen))
        validPoints.length = 0
      }
      continue
    }

    const point: Point2D = [x, y]
    const screen = transformToScreen(point)
    validPoints.push({ point, screen })

    // Check for discontinuity with previous point
    if (i > 0 && validPoints.length > 1) {
      const prevPoint = validPoints[validPoints.length - 2]
      const result = checkDiscontinuity(
        point,
        screen,
        prevPoint.point,
        prevPoint.screen,
        prevPoint.point[1], // lastY
        pixelsPerUnit,
        plot.tMin,
        plot.tMax,
        plot.points.length
      )

      if (result.shouldBreak) {
        // Draw current segment up to (but not including) the current point
        // Then add current point to start new segment
        const segmentToDraw = validPoints.slice(0, -1)
        if (segmentToDraw.length > 0) {
          drawSmoothCurve(ctx, segmentToDraw.map(p => p.screen))
        }
        // Start new segment with current point
        validPoints.splice(0, validPoints.length - 1)
      }
    }
  }

  // Draw remaining points
  if (validPoints.length > 0) {
    drawSmoothCurve(ctx, validPoints.map(p => p.screen))
  }
}

/**
 * Draw a parametric plot from string expressions using adaptive sampling
 */
function drawParametricFromExpressions(
  ctx: CanvasRenderingContext2D,
  plot: ParametricPlot,
  transformToScreen: (point: Point2D) => Point2D,
  _frame: CoordinateFrame,
  _viewport: ViewportState,
  _canvasWidth: number,
  _canvasHeight: number
): void {
  const tRange = plot.tMax - plot.tMin
  const baseNumPoints = plot.numPoints ?? Math.max(200, Math.min(2000, Math.round(tRange * 75)))
  const tMin = plot.tMin
  const tMax = plot.tMax
  const xFunc = plot.xFunc!
  const yFunc = plot.yFunc!

  // Use adaptive sampling: collect points with adaptive density
  const validPoints: Array<{ point: Point2D; screen: Point2D }> = []
  const maxDepth = 8 // Maximum recursion depth for adaptive sampling
  const minStep = (tMax - tMin) / 10000 // Minimum step size to prevent infinite recursion

  const pixelsPerUnit = calculatePixelsPerUnit(transformToScreen)

  // Adaptive sampling function
  const sampleAdaptive = (t1: number, t2: number, x1: number | null, y1: number | null, depth: number) => {
    if (depth > maxDepth || (t2 - t1) < minStep) {
      // Base case: evaluate at midpoint and add it
      try {
        const t = (t1 + t2) / 2
        const x = evaluateParametricExpression(xFunc, t)
        const y = evaluateParametricExpression(yFunc, t)
        if (isFinite(x) && isFinite(y)) {
          const point: Point2D = [x, y]
          const pointScreen = transformToScreen(point)
          validPoints.push({ point, screen: pointScreen })
        }
      } catch (e) {
        // Skip invalid points
      }
      return
    }

    // Evaluate at endpoints, midpoint, and quarter points
    let x1_val = x1
    let y1_val = y1
    let x2: number
    let y2: number
    let xMid: number
    let yMid: number
    let xQ1: number | null = null
    let yQ1: number | null = null
    let xQ3: number | null = null
    let yQ3: number | null = null

    try {
      if (x1_val === null || y1_val === null) {
        x1_val = evaluateParametricExpression(xFunc, t1)
        y1_val = evaluateParametricExpression(yFunc, t1)
      }
      x2 = evaluateParametricExpression(xFunc, t2)
      y2 = evaluateParametricExpression(yFunc, t2)
      const tMid = (t1 + t2) / 2
      xMid = evaluateParametricExpression(xFunc, tMid)
      yMid = evaluateParametricExpression(yFunc, tMid)
      
      const tQ1 = (t1 + tMid) / 2
      const tQ3 = (tMid + t2) / 2
      xQ1 = evaluateParametricExpression(xFunc, tQ1)
      yQ1 = evaluateParametricExpression(yFunc, tQ1)
      xQ3 = evaluateParametricExpression(xFunc, tQ3)
      yQ3 = evaluateParametricExpression(yFunc, tQ3)
    } catch (e) {
      // If evaluation fails, subdivide anyway
      const tMid = (t1 + t2) / 2
      try {
        const xMid = evaluateParametricExpression(xFunc, tMid)
        const yMid = evaluateParametricExpression(yFunc, tMid)
        if (isFinite(xMid) && isFinite(yMid)) {
          const point: Point2D = [xMid, yMid]
          const pointScreen = transformToScreen(point)
          validPoints.push({ point, screen: pointScreen })
        }
      } catch (e2) {
        // Skip if midpoint also fails
      }
      sampleAdaptive(t1, tMid, x1_val, y1_val, depth + 1)
      sampleAdaptive(tMid, t2, null, null, depth + 1)
      return
    }

    // Check if all values are finite
    const allFinite = 
      isFinite(x1_val) && isFinite(y1_val) &&
      isFinite(x2) && isFinite(y2) &&
      isFinite(xMid) && isFinite(yMid) &&
      (xQ1 === null || (isFinite(xQ1) && isFinite(yQ1))) &&
      (xQ3 === null || (isFinite(xQ3) && isFinite(yQ3)))

    if (!allFinite) {
      // Subdivide to find valid regions
      const tMid = (t1 + t2) / 2
      sampleAdaptive(t1, tMid, x1_val, y1_val, depth + 1)
      sampleAdaptive(tMid, t2, null, null, depth + 1)
      return
    }

    // Calculate linear interpolation at midpoint
    const xLinear = (x1_val + x2) / 2
    const yLinear = (y1_val + y2) / 2

    // Estimate curvature
    const dt = t2 - t1
    const dx1 = (xMid - x1_val) / (dt / 2)
    const dy1 = (yMid - y1_val) / (dt / 2)
    const dx2 = (x2 - xMid) / (dt / 2)
    const dy2 = (y2 - yMid) / (dt / 2)
    
    // Curvature is the change in direction
    const curvature = Math.abs(dx2 - dx1) + Math.abs(dy2 - dy1)

    // Calculate error metric
    const maxVal = Math.max(Math.abs(x1_val), Math.abs(y1_val), Math.abs(x2), Math.abs(y2), Math.abs(xMid), Math.abs(yMid))
    const linearError = Math.sqrt((xMid - xLinear) ** 2 + (yMid - yLinear) ** 2) / (maxVal + 1)
    const normalizedCurvature = curvature * dt * dt / (maxVal + 1)
    const combinedError = linearError + normalizedCurvature * 0.3

    // Subdivide if error is too large
    const errorThreshold = 0.01
    if (combinedError > errorThreshold) {
      const tMid = (t1 + t2) / 2
      sampleAdaptive(t1, tMid, x1_val, y1_val, depth + 1)
      sampleAdaptive(tMid, t2, null, null, depth + 1)
    } else {
      // Function is smooth - add midpoint if valid
      if (isFinite(xMid) && isFinite(yMid)) {
        const point: Point2D = [xMid, yMid]
        const pointScreen = transformToScreen(point)
        validPoints.push({ point, screen: pointScreen })
      }
    }
  }

  // Start with uniform sampling, then refine adaptively
  const initialStep = (tMax - tMin) / baseNumPoints
  const initialPoints: Array<{ t: number; x: number | null; y: number | null }> = []

  // First pass: uniform sampling
  for (let i = 0; i <= baseNumPoints; i++) {
    const t = tMin + i * initialStep
    try {
      const x = evaluateParametricExpression(xFunc, t)
      const y = evaluateParametricExpression(yFunc, t)
      if (isFinite(x) && isFinite(y)) {
        const point: Point2D = [x, y]
        const pointScreen = transformToScreen(point)
        validPoints.push({ point, screen: pointScreen })
        initialPoints.push({ t, x, y })
      } else {
        initialPoints.push({ t, x: null, y: null })
      }
    } catch (e) {
      initialPoints.push({ t, x: null, y: null })
    }
  }

  // Second pass: adaptive refinement between consecutive valid points
  for (let i = 0; i < initialPoints.length - 1; i++) {
    const p1 = initialPoints[i]
    const p2 = initialPoints[i + 1]
    
    if (p1.x !== null && p1.y !== null && p2.x !== null && p2.y !== null) {
      // Both points are valid - refine between them
      sampleAdaptive(p1.t, p2.t, p1.x, p1.y, 0)
    }
  }

  // Draw the curve with discontinuity detection
  if (validPoints.length === 0) {
    return
  }

  // Sort points by t (they should already be sorted, but ensure it)
  // For parametric plots, we keep the order by parameter t
  const segments: Point2D[][] = []
  let currentSegment: Point2D[] = []

  for (let i = 0; i < validPoints.length; i++) {
    const current = validPoints[i]
    
    if (i === 0) {
      currentSegment.push(current.screen)
      continue
    }

    const prev = validPoints[i - 1]
    const result = checkDiscontinuity(
      current.point,
      current.screen,
      prev.point,
      prev.screen,
      prev.point[1], // lastY
      pixelsPerUnit,
      plot.tMin,
      plot.tMax,
      validPoints.length
    )

    if (result.shouldBreak) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment)
      }
      currentSegment = [current.screen]
    } else {
      currentSegment.push(current.screen)
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment)
  }

  // Draw each segment
  for (const segment of segments) {
    if (segment.length > 0) {
      drawSmoothCurve(ctx, segment)
    }
  }
}

