import type { CoordinateFrame, ViewportState, Point2D, FunctionPlot } from '../types'
import {
  frameToScreen,
  nestedFrameToScreen,
} from './frameTransforms'
import { drawSmoothCurve } from './curveDrawing'
import { checkDiscontinuity, calculatePixelsPerUnit } from './discontinuityDetection'
import { evaluateExpression } from './expressionEvaluator'

/**
 * Draw function plots defined in a frame
 * Functions are evaluated and drawn as curves in frame coordinates
 */
export function drawFrameFunctions(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
): void {
  if (!frame.functions || frame.functions.length === 0) {
    return
  }

  // Transform function for converting frame coordinates to screen coordinates
  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)

  // Draw each function plot
  frame.functions.forEach((func: FunctionPlot) => {
    try {
      // Enable smoothing for function plots
      const oldSmoothing = ctx.imageSmoothingEnabled
      ctx.imageSmoothingEnabled = true
      
      ctx.strokeStyle = func.color
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      
      // If points are provided, use them directly (for callable functions evaluated in Python)
      if (func.points && func.points.length > 0) {
        drawFunctionFromPoints(ctx, func, transformToScreen)
      } else if (func.expression) {
        drawFunctionFromExpression(ctx, func, transformToScreen)
      }
      
      ctx.stroke()
      ctx.globalAlpha = 1.0
      
      // Restore original smoothing setting
      ctx.imageSmoothingEnabled = oldSmoothing
    } catch (error) {
      // If drawing fails, skip this function
      console.warn('[drawFrameFunctions] Failed to draw function:', func.expression || 'points', error)
    }
  })
}

/**
 * Draw a function from pre-computed points with discontinuity detection
 */
function drawFunctionFromPoints(
  ctx: CanvasRenderingContext2D,
  func: FunctionPlot,
  transformToScreen: (point: Point2D) => Point2D
): void {
  // Calculate pixels per unit for zoom-aware discontinuity detection
  const pixelsPerUnitAvg = calculatePixelsPerUnit(transformToScreen)
  
  // Collect valid points - only break on clear discontinuities
  const validPoints: Array<{ point: Point2D; screen: Point2D }> = []
  let lastPoint: Point2D | null = null
  let lastScreen: Point2D | null = null
  let lastY: number | null = null
  
  for (let i = 0; i < func.points!.length; i++) {
    const [x, y] = func.points![i]
    
    // Always break on invalid points (NaN, Infinity) - this is the primary discontinuity indicator
    if (!isFinite(x) || !isFinite(y)) {
      // Draw current segment before breaking
      if (validPoints.length > 1) {
        drawSmoothCurve(ctx, validPoints.map(p => p.screen))
        ctx.stroke()
      } else if (validPoints.length === 1) {
        ctx.moveTo(validPoints[0].screen[0], validPoints[0].screen[1])
      }
      ctx.beginPath()
      validPoints.length = 0
      lastPoint = null
      lastScreen = null
      lastY = null
      continue
    }
    
    const pointScreen = transformToScreen([x, y])
    
    // Check for discontinuity using the utility function
    if (lastScreen !== null && lastPoint !== null && lastY !== null) {
      const discontinuity = checkDiscontinuity(
        [x, y],
        pointScreen,
        lastPoint,
        lastScreen,
        lastY,
        pixelsPerUnitAvg,
        func.xMin,
        func.xMax,
        func.points!.length
      )
      
      if (discontinuity.shouldBreak) {
        // Discontinuity detected - draw current segment and start new one
        if (validPoints.length > 1) {
          drawSmoothCurve(ctx, validPoints.map(p => p.screen))
          ctx.stroke()
        } else if (validPoints.length === 1) {
          ctx.moveTo(validPoints[0].screen[0], validPoints[0].screen[1])
        }
        ctx.beginPath()
        validPoints.length = 0
        // Start new segment with current point
        validPoints.push({ point: [x, y], screen: pointScreen })
        lastPoint = [x, y]
        lastScreen = pointScreen
        lastY = y
        continue
      }
    }
    
    // Add point to current segment
    validPoints.push({ point: [x, y], screen: pointScreen })
    lastPoint = [x, y]
    lastScreen = pointScreen
    lastY = y
  }
  
  // Draw the final segment
  if (validPoints.length > 0) {
    if (validPoints.length === 1) {
      ctx.moveTo(validPoints[0].screen[0], validPoints[0].screen[1])
    } else {
      drawSmoothCurve(ctx, validPoints.map(p => p.screen))
    }
  }
}

/**
 * Draw a function from an expression using adaptive sampling
 */
function drawFunctionFromExpression(
  ctx: CanvasRenderingContext2D,
  func: FunctionPlot,
  transformToScreen: (point: Point2D) => Point2D
): void {
  // Calculate optimal number of points based on range if not specified
  const range = func.xMax - func.xMin
  const baseNumPoints = func.numPoints ?? Math.max(200, Math.min(2000, Math.round(range * 100)))
  const xMin = func.xMin
  const xMax = func.xMax
  const expression = func.expression! // Type guard: we know expression exists here
  
  // Use adaptive sampling: collect points with adaptive density
  // This helps capture rapid changes in functions like 1/tan(exp(x))
  const validPoints: Array<{ point: Point2D; screen: Point2D }> = []
  const maxDepth = 8 // Maximum recursion depth for adaptive sampling
  const minStep = (xMax - xMin) / 10000 // Minimum step size to prevent infinite recursion
  
  // Adaptive sampling function with derivative-based detection
  const sampleAdaptive = (x1: number, x2: number, y1: number | null, depth: number) => {
    if (depth > maxDepth || (x2 - x1) < minStep) {
      // Base case: evaluate at midpoint and add it
      try {
        const x = (x1 + x2) / 2
        const y = evaluateExpression(expression, x)
        if (isFinite(y)) {
          const pointScreen = transformToScreen([x, y])
          validPoints.push({ point: [x, y], screen: pointScreen })
        }
      } catch (e) {
        // Skip invalid points
      }
      return
    }
    
    // Evaluate at endpoints, midpoint, and quarter points for better derivative estimation
    let y1_val = y1
    let y2: number
    let yMid: number
    let yQ1: number | null = null
    let yQ3: number | null = null
    
    try {
      if (y1_val === null) {
        y1_val = evaluateExpression(expression, x1)
      }
      y2 = evaluateExpression(expression, x2)
      const xMid = (x1 + x2) / 2
      yMid = evaluateExpression(expression, xMid)
      
      // Check if all are finite
      if (!isFinite(y1_val) || !isFinite(y2) || !isFinite(yMid)) {
        return
      }
      
      // Evaluate at quarter points for better curvature estimation
      const xQ1 = (x1 + xMid) / 2
      const xQ3 = (xMid + x2) / 2
      try {
        yQ1 = evaluateExpression(expression, xQ1)
        yQ3 = evaluateExpression(expression, xQ3)
      } catch (e) {
        // If quarter points fail, continue with midpoint only
      }
      
      // Calculate linear interpolation at midpoint
      const yLinear = (y1_val + y2) / 2
      
      // Estimate first derivative (slope) at endpoints
      const dx = x2 - x1
      const slope1 = (xMid - x1) > 0 ? (yMid - y1_val) / (xMid - x1) : 0
      const slope2 = (x2 - xMid) > 0 ? (y2 - yMid) / (x2 - xMid) : 0
      
      // Estimate second derivative (curvature) if quarter points are available
      let curvature = 0
      if (yQ1 !== null && yQ3 !== null && isFinite(yQ1) && isFinite(yQ3)) {
        const slopeQ1 = (xMid - xQ1) > 0 ? (yMid - yQ1) / (xMid - xQ1) : 0
        const slopeQ3 = (xQ3 - xMid) > 0 ? (yQ3 - yMid) / (xQ3 - xMid) : 0
        curvature = (xQ3 - xQ1) > 0 ? Math.abs(slopeQ3 - slopeQ1) / (xQ3 - xQ1) : 0
      } else {
        // Fallback: estimate curvature from slope change
        curvature = dx > 0 ? Math.abs(slope2 - slope1) / dx : 0
      }
      
      // Calculate error metric: combination of deviation from linear and curvature
      const maxY = Math.max(Math.abs(y1_val), Math.abs(y2), Math.abs(yMid), 1)
      const linearError = Math.abs(yMid - yLinear) / (maxY + 1)
      
      // Normalize curvature by function scale and x-range
      const normalizedCurvature = curvature * dx * dx / (maxY + 1)
      
      // Combined error metric: linear error + curvature contribution
      // Curvature is weighted less since it's a second-order effect
      const combinedError = linearError + normalizedCurvature * 0.3
      
      // Adaptive threshold: more sensitive for smaller ranges
      const rangeScale = Math.max(1, (xMax - xMin) / 10)
      const threshold = 0.03 / rangeScale // More sensitive for smaller ranges
      
      // Also check for rapid slope change
      const slopeChangeRatio = Math.abs(slope2 - slope1) / (Math.abs(slope1) + Math.abs(slope2) + 1)
      
      if (combinedError > threshold || slopeChangeRatio > 0.5) {
        // Function changes rapidly or has high curvature - subdivide and add all points
        const pointScreen = transformToScreen([xMid, yMid])
        validPoints.push({ point: [xMid, yMid], screen: pointScreen })
        
        // Add quarter points if they're valid
        if (yQ1 !== null && isFinite(yQ1)) {
          const pointScreenQ1 = transformToScreen([xQ1, yQ1])
          validPoints.push({ point: [xQ1, yQ1], screen: pointScreenQ1 })
        }
        if (yQ3 !== null && isFinite(yQ3)) {
          const pointScreenQ3 = transformToScreen([xQ3, yQ3])
          validPoints.push({ point: [xQ3, yQ3], screen: pointScreenQ3 })
        }
        
        // Recursively subdivide both halves
        sampleAdaptive(x1, xMid, y1_val, depth + 1)
        sampleAdaptive(xMid, x2, yMid, depth + 1)
      } else {
        // Function is smooth - just add midpoint
        const pointScreen = transformToScreen([xMid, yMid])
        validPoints.push({ point: [xMid, yMid], screen: pointScreen })
      }
    } catch (e) {
      // If evaluation fails, try to subdivide anyway
      const xMid = (x1 + x2) / 2
      try {
        const yMid = evaluateExpression(expression, xMid)
        if (isFinite(yMid)) {
          const pointScreen = transformToScreen([xMid, yMid])
          validPoints.push({ point: [xMid, yMid], screen: pointScreen })
        }
      } catch (e2) {
        // Skip if midpoint also fails
      }
      sampleAdaptive(x1, xMid, y1_val, depth + 1)
      sampleAdaptive(xMid, x2, null, depth + 1)
    }
  }
  
  // Start with uniform sampling, then refine adaptively
  const initialStep = (xMax - xMin) / baseNumPoints
  const initialPoints: Array<{ x: number; y: number | null }> = []
  
  // First pass: uniform sampling
  for (let i = 0; i <= baseNumPoints; i++) {
    const x = xMin + i * initialStep
    try {
      const y = evaluateExpression(expression, x)
      if (isFinite(y)) {
        const pointScreen = transformToScreen([x, y])
        validPoints.push({ point: [x, y], screen: pointScreen })
        initialPoints.push({ x, y })
      } else {
        initialPoints.push({ x, y: null })
      }
    } catch (e) {
      initialPoints.push({ x, y: null })
    }
  }
  
  // Second pass: adaptive refinement between consecutive valid points
  // Check for rapid changes in function value, not just screen distance
  for (let i = 0; i < initialPoints.length - 1; i++) {
    const p1 = initialPoints[i]
    const p2 = initialPoints[i + 1]
    
    if (p1.y !== null && p2.y !== null) {
      // Calculate the actual function change rate
      const xDiff = Math.abs(p2.x - p1.x)
      
      // If x difference is significant, check if we need more detail
      if (xDiff > (xMax - xMin) / baseNumPoints * 2) {
        // Evaluate at midpoint to check for rapid change
        try {
          const xMid = (p1.x + p2.x) / 2
          const yMid = evaluateExpression(expression, xMid)
          
          if (isFinite(yMid)) {
            // Check if function changes rapidly (non-linear)
            const yLinear = (p1.y + p2.y) / 2
            const changeRatio = Math.abs(yMid - yLinear) / (Math.max(Math.abs(p1.y), Math.abs(p2.y), 1) + 1)
            const threshold = 0.1 // 10% difference triggers subdivision
            
            if (changeRatio > threshold) {
              // Function changes rapidly - subdivide
              sampleAdaptive(p1.x, p2.x, p1.y, 0)
            }
          }
        } catch (e) {
          // If evaluation fails, subdivide anyway to be safe
          sampleAdaptive(p1.x, p2.x, p1.y, 0)
        }
      }
    }
  }
  
  // Sort points by x coordinate (adaptive sampling may add points out of order)
  validPoints.sort((a, b) => a.point[0] - b.point[0])
  
  // Draw the curve - connect all valid points in order
  // Only break when we encounter invalid points (already filtered out above)
  const segmentPoints: Point2D[] = validPoints.map(p => p.point)
  
  // Draw the final segment
  if (segmentPoints.length > 0) {
    if (segmentPoints.length === 1) {
      const screen = transformToScreen(segmentPoints[0])
      ctx.moveTo(screen[0], screen[1])
    } else {
      drawSmoothCurve(ctx, segmentPoints.map(p => transformToScreen(p)))
    }
  }
}

