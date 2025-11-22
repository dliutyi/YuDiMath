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
  allFrames: CoordinateFrame[]
) {
  const { bounds, origin } = frame

  // Convert frame bounds to screen coordinates
  const topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
  const bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)
  const originScreen = worldToScreen(origin[0], origin[1], viewport, canvasWidth, canvasHeight)

  // Draw frame border
  ctx.strokeStyle = '#60a5fa' // lighter blue
  ctx.lineWidth = 2
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
  drawFrameGrid(ctx, frame, viewport, canvasWidth, canvasHeight)

  // Recursively draw child frames
  frame.childFrameIds.forEach(childId => {
    const childFrame = allFrames.find(f => f.id === childId)
    if (childFrame) {
      drawCoordinateFrame(ctx, childFrame, viewport, canvasWidth, canvasHeight, allFrames)
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
  const { bounds, baseI, baseJ } = frame

  // Calculate base vector magnitudes
  const iMagnitude = Math.sqrt(baseI[0] ** 2 + baseI[1] ** 2)
  const jMagnitude = Math.sqrt(baseJ[0] ** 2 + baseJ[1] ** 2)
  
  // Use a reasonable grid step (e.g., 1 unit in frame coordinates)
  const gridStep = 1.0

  ctx.strokeStyle = '#475569' // slate-600
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.3
  ctx.setLineDash([])

  // The bounds define the frame viewport in parent coordinates
  // We need to convert bounds to frame coordinates to know how many grid lines to draw
  // For now, we'll estimate based on the bounds dimensions and base vector magnitudes
  // This is a simplification - a more accurate approach would require inverse transformation
  
  // Estimate frame dimensions in frame coordinates
  // bounds.width and bounds.height are in parent coordinates
  // We approximate by dividing by the average magnitude
  const avgMagnitude = (iMagnitude + jMagnitude) / 2
  const frameWidth = bounds.width / avgMagnitude
  const frameHeight = bounds.height / avgMagnitude

  // Draw grid lines along baseI direction (lines parallel to baseJ)
  // These are lines at constant u values
  const numLinesI = Math.ceil(frameWidth / gridStep)
  for (let i = 0; i <= numLinesI; i++) {
    const u = i * gridStep
    // Start and end points in frame coordinates: (u, 0) to (u, frameHeight)
    const startPoint = frameToParent([u, 0], frame)
    const endPoint = frameToParent([u, frameHeight], frame)
    
    const startScreen = worldToScreen(startPoint[0], startPoint[1], viewport, canvasWidth, canvasHeight)
    const endScreen = worldToScreen(endPoint[0], endPoint[1], viewport, canvasWidth, canvasHeight)
    
    ctx.beginPath()
    ctx.moveTo(Math.round(startScreen[0]) + 0.5, Math.round(startScreen[1]) + 0.5)
    ctx.lineTo(Math.round(endScreen[0]) + 0.5, Math.round(endScreen[1]) + 0.5)
    ctx.stroke()
  }

  // Draw grid lines along baseJ direction (lines parallel to baseI)
  // These are lines at constant v values
  const numLinesJ = Math.ceil(frameHeight / gridStep)
  for (let j = 0; j <= numLinesJ; j++) {
    const v = j * gridStep
    // Start and end points in frame coordinates: (0, v) to (frameWidth, v)
    const startPoint = frameToParent([0, v], frame)
    const endPoint = frameToParent([frameWidth, v], frame)
    
    const startScreen = worldToScreen(startPoint[0], startPoint[1], viewport, canvasWidth, canvasHeight)
    const endScreen = worldToScreen(endPoint[0], endPoint[1], viewport, canvasWidth, canvasHeight)
    
    ctx.beginPath()
    ctx.moveTo(Math.round(startScreen[0]) + 0.5, Math.round(startScreen[1]) + 0.5)
    ctx.lineTo(Math.round(endScreen[0]) + 0.5, Math.round(endScreen[1]) + 0.5)
    ctx.stroke()
  }

  ctx.globalAlpha = 1.0
}

