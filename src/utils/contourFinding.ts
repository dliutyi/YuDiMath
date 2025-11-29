import type { Point2D } from '../types'
import { evaluateImplicitExpression } from './expressionEvaluator'

/**
 * Find contour points where f(x, y) = 0 using the marching squares algorithm
 * @param equation The implicit equation (string expression)
 * @param xMin Minimum x value
 * @param xMax Maximum x value
 * @param yMin Minimum y value
 * @param yMax Maximum y value
 * @param gridResolution Number of grid cells per dimension (default: adaptive)
 * @param maxDepth Maximum recursion depth for adaptive refinement (default: 3)
 * @returns Array of contour point arrays (each array represents a connected contour segment)
 */
export function findContourPoints(
  equation: string,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  gridResolution?: number,
  maxDepth: number = 3
): Point2D[][] {
  // Calculate adaptive grid resolution if not provided
  const xRange = xMax - xMin
  const yRange = yMax - yMin
  const avgRange = (xRange + yRange) / 2
  const resolution = gridResolution ?? Math.max(50, Math.min(500, Math.round(avgRange * 50)))
  
  const dx = xRange / resolution
  const dy = yRange / resolution
  
  // Evaluate equation at grid points
  const grid: number[][] = []
  let evaluationErrors = 0
  let validValues = 0
  for (let i = 0; i <= resolution; i++) {
    grid[i] = []
    const y = yMin + i * dy
    for (let j = 0; j <= resolution; j++) {
      const x = xMin + j * dx
      try {
        const value = evaluateImplicitExpression(equation, x, y)
        if (isFinite(value)) {
          grid[i][j] = value
          validValues++
        } else {
          grid[i][j] = Number.NaN
        }
      } catch (e) {
        grid[i][j] = Number.NaN
        evaluationErrors++
        // Log first few errors for debugging
        if (evaluationErrors <= 3) {
          console.warn(`[findContourPoints] Error evaluating equation "${equation}" at (${x}, ${y}):`, e)
        }
      }
    }
  }
  if (evaluationErrors > 0) {
    console.warn(`[findContourPoints] Total evaluation errors: ${evaluationErrors} out of ${(resolution + 1) ** 2} points, valid: ${validValues}`)
  }
  
  // Find zero-crossings using marching squares
  const contours: Point2D[][] = []
  const visited = new Set<string>()
  
  // Use adaptive refinement near origin for better quality
  const nearOriginThreshold = Math.max(xRange, yRange) * 0.1
  
  // Process each cell in the grid
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const cellKey = `${i},${j}`
      if (visited.has(cellKey)) continue
      
      // Get corner values
      const v00 = grid[i][j]         // Top-left
      const v10 = grid[i + 1][j]    // Bottom-left
      const v01 = grid[i][j + 1]    // Top-right
      const v11 = grid[i + 1][j + 1] // Bottom-right
      
      // Skip if any corner is NaN
      if (!isFinite(v00) || !isFinite(v10) || !isFinite(v01) || !isFinite(v11)) {
        continue
      }
      
      // Check if cell is near origin for adaptive refinement
      const x0 = xMin + j * dx
      const y0 = yMin + i * dy
      const x1 = x0 + dx
      const y1 = y0 + dy
      const cellCenterX = (x0 + x1) / 2
      const cellCenterY = (y0 + y1) / 2
      const distFromOrigin = Math.sqrt(cellCenterX ** 2 + cellCenterY ** 2)
      const isNearOrigin = distFromOrigin < nearOriginThreshold
      
      // Check for zero-crossings
      const signs = [
        Math.sign(v00),
        Math.sign(v10),
        Math.sign(v01),
        Math.sign(v11),
      ]
      
      // Count sign changes (zero-crossings)
      const signChanges = [
        signs[0] !== signs[1], // Left edge
        signs[1] !== signs[3], // Bottom edge
        signs[3] !== signs[2], // Right edge
        signs[2] !== signs[0], // Top edge
      ]
      
      const numSignChanges = signChanges.filter(Boolean).length
      
      // If there are zero-crossings, find contour points
      // Use higher depth near origin for better quality
      if (numSignChanges > 0) {
        const adaptiveDepth = isNearOrigin ? maxDepth + 1 : maxDepth
        const cellContours = findContourInCell(
          equation,
          xMin + j * dx,
          yMin + i * dy,
          dx,
          dy,
          v00,
          v10,
          v01,
          v11,
          adaptiveDepth
        )
        
        // Merge cell contours into main contours
        for (const cellContour of cellContours) {
          if (cellContour.length > 0) {
            // Try to merge with existing contours
            let merged = false
            for (const contour of contours) {
              if (contour.length > 0) {
                const lastPoint = contour[contour.length - 1]
                const firstPoint = cellContour[0]
                const distance = Math.sqrt(
                  (lastPoint[0] - firstPoint[0]) ** 2 + (lastPoint[1] - firstPoint[1]) ** 2
                )
                // If points are close, merge contours
                if (distance < Math.max(dx, dy) * 1.5) {
                  contour.push(...cellContour)
                  merged = true
                  break
                }
              }
            }
            if (!merged) {
              contours.push(cellContour)
            }
          }
        }
        
        visited.add(cellKey)
      }
    }
  }
  
  // Filter out very short contours (likely noise)
  return contours.filter(contour => contour.length >= 2)
}

/**
 * Find contour points within a single cell using recursive subdivision
 */
function findContourInCell(
  equation: string,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  v00: number,
  v10: number,
  v01: number,
  v11: number,
  depth: number
): Point2D[][] {
  const minCellSize = Math.min(dx, dy) / 100 // Minimum cell size for subdivision
  
  // Base case: cell is too small or depth limit reached
  if (depth <= 0 || Math.min(dx, dy) < minCellSize) {
    // Use improved linear interpolation to find zero-crossing points
    // Better handling near origin and zero values
    const points: Point2D[] = []
    
    // Helper function for stable interpolation
    const interpolate = (p1: number, p2: number, v1: number, v2: number): number | null => {
      if (Math.abs(v1) < 1e-10) return p1
      if (Math.abs(v2) < 1e-10) return p2
      if (Math.sign(v1) === Math.sign(v2)) return null
      const denominator = v2 - v1
      if (Math.abs(denominator) < 1e-10) return (p1 + p2) / 2
      const t = Math.max(0, Math.min(1, -v1 / denominator))
      return p1 + t * (p2 - p1)
    }
    
    // Check each edge for zero-crossings
    // Left edge (v00 to v10)
    if (Math.sign(v00) !== Math.sign(v10)) {
      const y = interpolate(y0, y0 + dy, v00, v10)
      if (y !== null) points.push([x0, y])
    }
    
    // Bottom edge (v10 to v11)
    if (Math.sign(v10) !== Math.sign(v11)) {
      const x = interpolate(x0, x0 + dx, v10, v11)
      if (x !== null) points.push([x, y0 + dy])
    }
    
    // Right edge (v01 to v11)
    if (Math.sign(v01) !== Math.sign(v11)) {
      const y = interpolate(y0, y0 + dy, v01, v11)
      if (y !== null) points.push([x0 + dx, y])
    }
    
    // Top edge (v00 to v01)
    if (Math.sign(v00) !== Math.sign(v01)) {
      const x = interpolate(x0, x0 + dx, v00, v01)
      if (x !== null) points.push([x, y0])
    }
    
    return points.length > 0 ? [points] : []
  }
  
  // Recursive case: subdivide cell
  const xMid = x0 + dx / 2
  const yMid = y0 + dy / 2
  
  // Evaluate at midpoint and quarter points
  let vMid: number
  let vQ1: number, vQ2: number, vQ3: number, vQ4: number
  
  try {
    vMid = evaluateImplicitExpression(equation, xMid, yMid)
    vQ1 = evaluateImplicitExpression(equation, x0 + dx / 4, y0 + dy / 4)
    vQ2 = evaluateImplicitExpression(equation, x0 + 3 * dx / 4, y0 + dy / 4)
    vQ3 = evaluateImplicitExpression(equation, x0 + 3 * dx / 4, y0 + 3 * dy / 4)
    vQ4 = evaluateImplicitExpression(equation, x0 + dx / 4, y0 + 3 * dy / 4)
  } catch (e) {
    // If evaluation fails, use linear interpolation
    return findContourInCell(equation, x0, y0, dx, dy, v00, v10, v01, v11, 0)
  }
  
  if (!isFinite(vMid) || !isFinite(vQ1) || !isFinite(vQ2) || !isFinite(vQ3) || !isFinite(vQ4)) {
    return findContourInCell(equation, x0, y0, dx, dy, v00, v10, v01, v11, 0)
  }
  
  // Subdivide into 4 sub-cells
  const subContours: Point2D[][] = []
  
  // Top-left sub-cell
  subContours.push(...findContourInCell(
    equation,
    x0, y0,
    dx / 2, dy / 2,
    v00, vMid, vQ1, vQ2,
    depth - 1
  ))
  
  // Top-right sub-cell
  subContours.push(...findContourInCell(
    equation,
    xMid, y0,
    dx / 2, dy / 2,
    vQ1, vQ2, v01, vMid,
    depth - 1
  ))
  
  // Bottom-left sub-cell
  subContours.push(...findContourInCell(
    equation,
    x0, yMid,
    dx / 2, dy / 2,
    vMid, v10, vQ4, vQ3,
    depth - 1
  ))
  
  // Bottom-right sub-cell
  subContours.push(...findContourInCell(
    equation,
    xMid, yMid,
    dx / 2, dy / 2,
    vQ2, vQ3, vMid, v11,
    depth - 1
  ))
  
  return subContours
}

