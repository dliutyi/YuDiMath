import type { CoordinateFrame, ViewportState, Point2D } from '../types'
import { worldToScreen } from '../utils/coordinates'

/**
 * Transform a point from frame coordinates to parent coordinates
 * @param point Point in frame coordinates [u, v]
 * @param frame The coordinate frame
 * @returns Point in parent coordinates [x, y]
 */
function frameToParent(point: Point2D, frame: CoordinateFrame): Point2D {
  const [u, v] = point
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Transform: origin + u * baseI + v * baseJ
  return [
    originX + u * iX + v * jX,
    originY + u * iY + v * jY
  ]
}

/**
 * Draw a coordinate frame on the canvas
 * This function is called from the Canvas component's draw function
 */
export function drawCoordinateFrame(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[],
  selectedFrameId: string | null = null
) {
  const { bounds, origin } = frame
  const isSelected = frame.id === selectedFrameId

  // Convert frame bounds to screen coordinates
  const topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
  const bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)
  const originScreen = worldToScreen(origin[0], origin[1], viewport, canvasWidth, canvasHeight)

  // Draw frame border with different style if selected
  ctx.strokeStyle = isSelected ? '#3b82f6' : '#60a5fa' // brighter blue if selected
  ctx.lineWidth = isSelected ? 3 : 2 // thicker if selected
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.rect(
    Math.round(topLeft[0]) + 0.5,
    Math.round(topLeft[1]) + 0.5,
    bottomRight[0] - topLeft[0],
    bottomRight[1] - topLeft[1]
  )
  ctx.stroke()

  // Calculate base vector endpoints in parent coordinates
  // Base vectors are in frame coordinates, so we need to transform them
  // For display, we'll scale them to a reasonable size (e.g., 1 unit in frame coordinates)
  const baseVectorScale = 1.0 // 1 unit in frame coordinates
  const baseIEnd = frameToParent([baseVectorScale, 0], frame)
  const baseJEnd = frameToParent([0, baseVectorScale], frame)
  
  const baseIEndScreen = worldToScreen(baseIEnd[0], baseIEnd[1], viewport, canvasWidth, canvasHeight)
  const baseJEndScreen = worldToScreen(baseJEnd[0], baseJEnd[1], viewport, canvasWidth, canvasHeight)

  // Draw base i vector (red)
  ctx.strokeStyle = '#ef4444' // red
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(Math.round(originScreen[0]) + 0.5, Math.round(originScreen[1]) + 0.5)
  ctx.lineTo(Math.round(baseIEndScreen[0]) + 0.5, Math.round(baseIEndScreen[1]) + 0.5)
  ctx.stroke()

  // Draw base j vector (blue)
  ctx.strokeStyle = '#3b82f6' // blue
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(Math.round(originScreen[0]) + 0.5, Math.round(originScreen[1]) + 0.5)
  ctx.lineTo(Math.round(baseJEndScreen[0]) + 0.5, Math.round(baseJEndScreen[1]) + 0.5)
  ctx.stroke()

  // Draw frame origin
  ctx.fillStyle = '#cbd5e1' // text-secondary
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('O', originScreen[0], originScreen[1] + 5)

  // Draw frame grid (lines along baseI and baseJ directions)
  // Save context state before clipping
  ctx.save()
  
  // Clip drawing to frame bounds
  ctx.beginPath()
  ctx.rect(
    Math.round(topLeft[0]) + 0.5,
    Math.round(topLeft[1]) + 0.5,
    bottomRight[0] - topLeft[0],
    bottomRight[1] - topLeft[1]
  )
  ctx.clip()
  
  // Draw grid within clipped region
  drawFrameGrid(ctx, frame, viewport, canvasWidth, canvasHeight)
  
  // Restore context state (removes clip)
  ctx.restore()

  // Recursively draw child frames
  frame.childFrameIds.forEach(childId => {
    const childFrame = allFrames.find(f => f.id === childId)
    if (childFrame) {
      drawCoordinateFrame(ctx, childFrame, viewport, canvasWidth, canvasHeight, allFrames, selectedFrameId)
    }
  })
}

/**
 * Draw the coordinate grid for a frame
 * Grid lines follow the directions of baseI and baseJ
 */
function drawFrameGrid(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
) {
  const { bounds, baseI, baseJ, origin } = frame

  // Use viewport grid step (inherited from background grid)
  // This ensures frame grid aligns with background grid when base vectors are standard
  const gridStep = viewport.gridStep

  // Make frame grid visually distinct from background grid
  // Use a different color (purple/indigo) and slightly higher opacity
  ctx.strokeStyle = '#6366f1' // indigo-500 - distinct from background grid
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.4 // Slightly more visible than background grid (0.3)
  ctx.setLineDash([])

  // Calculate frame dimensions in frame coordinates
  // The frame bounds are in parent coordinates, and the origin is at the center
  // We need to find the corners of the frame in frame coordinates
  
  // Frame corners in parent coordinates
  const corners = [
    [bounds.x, bounds.y + bounds.height], // top-left
    [bounds.x + bounds.width, bounds.y + bounds.height], // top-right
    [bounds.x + bounds.width, bounds.y], // bottom-right
    [bounds.x, bounds.y], // bottom-left
  ]
  
  // Convert corners to frame coordinates
  // To convert from parent to frame: solve origin + u*baseI + v*baseJ = corner
  // This is a 2x2 linear system: [baseI baseJ] * [u; v] = corner - origin
  const [originX, originY] = origin
  
  // Calculate inverse transformation matrix
  // [u; v] = [baseI_x baseJ_x; baseI_y baseJ_y]^-1 * [x - originX; y - originY]
  const det = baseI[0] * baseJ[1] - baseI[1] * baseJ[0]
  if (Math.abs(det) < 1e-10) {
    // Degenerate case: base vectors are parallel, skip grid
    ctx.globalAlpha = 1.0
    return
  }
  
  const invDet = 1.0 / det
  const invMatrix = [
    [baseJ[1] * invDet, -baseJ[0] * invDet],
    [-baseI[1] * invDet, baseI[0] * invDet]
  ]
  
  // Find min/max u and v values in frame coordinates
  let minU = Infinity, maxU = -Infinity
  let minV = Infinity, maxV = -Infinity
  
  for (const [px, py] of corners) {
    const dx = px - originX
    const dy = py - originY
    const u = invMatrix[0][0] * dx + invMatrix[0][1] * dy
    const v = invMatrix[1][0] * dx + invMatrix[1][1] * dy
    
    minU = Math.min(minU, u)
    maxU = Math.max(maxU, u)
    minV = Math.min(minV, v)
    maxV = Math.max(maxV, v)
  }
  
  // Expand range slightly to ensure full coverage
  const padding = gridStep * 2
  minU -= padding
  maxU += padding
  minV -= padding
  maxV += padding

  // Draw grid lines along baseI direction (lines parallel to baseJ)
  // These are lines at constant u values
  const startU = Math.floor(minU / gridStep) * gridStep
  const endU = Math.ceil(maxU / gridStep) * gridStep
  for (let u = startU; u <= endU; u += gridStep) {
    // Line endpoints in frame coordinates: (u, minV) to (u, maxV)
    const startPoint = frameToParent([u, minV], frame)
    const endPoint = frameToParent([u, maxV], frame)
    
    const startScreen = worldToScreen(startPoint[0], startPoint[1], viewport, canvasWidth, canvasHeight)
    const endScreen = worldToScreen(endPoint[0], endPoint[1], viewport, canvasWidth, canvasHeight)
    
    ctx.beginPath()
    ctx.moveTo(Math.round(startScreen[0]) + 0.5, Math.round(startScreen[1]) + 0.5)
    ctx.lineTo(Math.round(endScreen[0]) + 0.5, Math.round(endScreen[1]) + 0.5)
    ctx.stroke()
  }

  // Draw grid lines along baseJ direction (lines parallel to baseI)
  // These are lines at constant v values
  const startV = Math.floor(minV / gridStep) * gridStep
  const endV = Math.ceil(maxV / gridStep) * gridStep
  for (let v = startV; v <= endV; v += gridStep) {
    // Line endpoints in frame coordinates: (minU, v) to (maxU, v)
    const startPoint = frameToParent([minU, v], frame)
    const endPoint = frameToParent([maxU, v], frame)
    
    const startScreen = worldToScreen(startPoint[0], startPoint[1], viewport, canvasWidth, canvasHeight)
    const endScreen = worldToScreen(endPoint[0], endPoint[1], viewport, canvasWidth, canvasHeight)
    
    ctx.beginPath()
    ctx.moveTo(Math.round(startScreen[0]) + 0.5, Math.round(startScreen[1]) + 0.5)
    ctx.lineTo(Math.round(endScreen[0]) + 0.5, Math.round(endScreen[1]) + 0.5)
    ctx.stroke()
  }

  // Restore global alpha
  ctx.globalAlpha = 1.0
}

