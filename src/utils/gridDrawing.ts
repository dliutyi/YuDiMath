import type { CoordinateFrame, ViewportState, Point2D } from '../types'
import { worldToScreen, screenToWorld } from '../utils/coordinates'
import {
  frameToScreen,
  nestedFrameToScreen,
  parentToFrame,
  screenToFrame,
} from './frameTransforms'
import { getGridColorForLevel } from './frameUtils'

/**
 * Draw the coordinate grid for a frame
 * Grid lines follow the directions of baseI and baseJ
 * Grid is drawn at integer intervals (1, 2, 3, ...) in frame coordinates
 * The base vectors themselves determine how these transform to screen space
 */
export function drawFrameGrid(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  nestingLevel: number = 0,
  allFrames: CoordinateFrame[] = []
): void {
  const { bounds, viewport: frameViewport } = frame
  const { baseI, baseJ } = frame

  // Check if base vectors are zero or collinear
  const baseIMagnitude = Math.sqrt(baseI[0] ** 2 + baseI[1] ** 2)
  const baseJMagnitude = Math.sqrt(baseJ[0] ** 2 + baseJ[1] ** 2)
  const areZero = baseIMagnitude < 1e-10 && baseJMagnitude < 1e-10
  const areCollinear = !areZero && Math.abs(baseI[0] * baseJ[1] - baseI[1] * baseJ[0]) < 1e-10

  const gridColor = getGridColorForLevel(nestingLevel)
  
  // Use warning colors for degenerate cases
  if (areZero) {
    ctx.strokeStyle = '#ef4444' // red for zero vectors
    ctx.fillStyle = '#ef4444'
  } else if (areCollinear) {
    ctx.strokeStyle = '#f59e0b' // orange for collinear vectors
  } else {
    ctx.strokeStyle = gridColor
  }
  
  ctx.lineWidth = areZero ? 2 : (areCollinear ? 1 : 1) // Thicker only for zero, normal for collinear
  ctx.globalAlpha = areZero || areCollinear ? 0.9 : 0.7 // More opaque for degenerate cases
  ctx.setLineDash(areCollinear ? [5, 5] : []) // Dashed lines for collinear case

  // Transform function for converting frame coordinates to screen coordinates
  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)

  // Grid spacing is 1.0 (integer intervals) in frame coordinates
  const gridStep = 1.0
  const frameZoom = frameViewport.zoom
  const framePanX = frameViewport.x
  const framePanY = frameViewport.y

  // Calculate visible frame coordinate range by sampling points along frame bounds
  // Transform multiple points from screen to frame coordinates to determine visible range
  const topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
  const bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)
  
  // Sample points along the frame bounds (corners and midpoints)
  const samplePoints: Point2D[] = [
    topLeft,
    [bottomRight[0], topLeft[1]], // top-right
    bottomRight,
    [topLeft[0], bottomRight[1]], // bottom-left
    [(topLeft[0] + bottomRight[0]) / 2, topLeft[1]], // top-mid
    [(topLeft[0] + bottomRight[0]) / 2, bottomRight[1]], // bottom-mid
    [topLeft[0], (topLeft[1] + bottomRight[1]) / 2], // left-mid
    [bottomRight[0], (topLeft[1] + bottomRight[1]) / 2], // right-mid
  ]
  
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity

  // Transform each sample point to frame coordinates
  for (const screenPoint of samplePoints) {
    let pointInFrameCoords: Point2D
    
    if (frame.parentFrameId) {
      // For nested frames, transform through parent chain
      const worldPoint = screenToWorld(screenPoint[0], screenPoint[1], viewport, canvasWidth, canvasHeight)
      const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
      
      if (parentFrame) {
        // Transform world -> parent frame coords (raw, no viewport)
        const parentFrameCoordsRaw = parentToFrame(worldPoint, parentFrame)
        
        // Apply parent frame viewport to get visible parent frame coords
        const parentFrameU = (parentFrameCoordsRaw[0] - parentFrame.viewport.x) * parentFrame.viewport.zoom
        const parentFrameV = (parentFrameCoordsRaw[1] - parentFrame.viewport.y) * parentFrame.viewport.zoom
        
        // Transform parent frame coords back to parent world
        const [parentOriginX, parentOriginY] = parentFrame.origin
        const [parentIX, parentIY] = parentFrame.baseI
        const [parentJX, parentJY] = parentFrame.baseJ
        
        const parentWorldX = parentOriginX + parentFrameU * parentIX + parentFrameV * parentJX
        const parentWorldY = parentOriginY + parentFrameU * parentIY + parentFrameV * parentJY
        
        // Transform to this frame's coordinates (raw, no viewport)
        const [originX, originY] = frame.origin
        const dx = parentWorldX - originX
        const dy = parentWorldY - originY
        const [iX, iY] = frame.baseI
        const [jX, jY] = frame.baseJ
        
        const det = iX * jY - iY * jX
        if (Math.abs(det) > 1e-10) {
          const u = (dx * jY - dy * jX) / det
          const v = (dy * iX - dx * iY) / det
          // Account for frame viewport to get visible frame coordinates
          pointInFrameCoords = [
            (u / frameZoom) + framePanX,
            (v / frameZoom) + framePanY
          ]
        } else {
          pointInFrameCoords = [0, 0]
        }
      } else {
        pointInFrameCoords = [0, 0]
      }
    } else {
      // For top-level frames, use screenToFrame which handles all transformations
      pointInFrameCoords = screenToFrame(screenPoint, frame, viewport, canvasWidth, canvasHeight)
    }
    
    minU = Math.min(minU, pointInFrameCoords[0])
    maxU = Math.max(maxU, pointInFrameCoords[0])
    minV = Math.min(minV, pointInFrameCoords[1])
    maxV = Math.max(maxV, pointInFrameCoords[1])
  }
  
  // Calculate how many frame coordinate units correspond to screen pixels
  // This helps determine appropriate padding
  const originScreen = transformToScreen([0, 0])
  const oneUnitUScreen = transformToScreen([1, 0])
  const oneUnitVScreen = transformToScreen([0, 1])
  
  const screenUnitsPerU = Math.abs(oneUnitUScreen[0] - originScreen[0])
  const screenUnitsPerV = Math.abs(oneUnitVScreen[1] - originScreen[1])
  const avgScreenUnitsPerFrameUnit = (screenUnitsPerU + screenUnitsPerV) / 2
  
  // Calculate padding: ensure we draw enough grid to cover the frame bounds plus extra
  // Padding should be based on how much screen space we need to cover
  const frameScreenWidth = Math.abs(bottomRight[0] - topLeft[0])
  const frameScreenHeight = Math.abs(bottomRight[1] - topLeft[1])
  const maxScreenDimension = Math.max(frameScreenWidth, frameScreenHeight)
  
  // Convert screen dimension to frame coordinate units, then add generous padding
  const frameUnitsForScreen = avgScreenUnitsPerFrameUnit > 0 
    ? maxScreenDimension / avgScreenUnitsPerFrameUnit 
    : 10
  
  const frameRangeU = maxU - minU
  const frameRangeV = maxV - minV
  const maxRange = Math.max(frameRangeU, frameRangeV, frameUnitsForScreen)
  
  // Use generous padding: at least 3x the range or 20 units, whichever is larger
  // This ensures grid extends well beyond visible area when panning/zooming
  const padding = Math.max(maxRange * 3, 20)
  
  const expandedMinU = minU - padding
  const expandedMaxU = maxU + padding
  const expandedMinV = minV - padding
  const expandedMaxV = maxV + padding

  // Handle degenerate cases
  if (areZero) {
    // Zero vectors: draw just a dot at the origin
    const originScreen = transformToScreen([0, 0])
    ctx.beginPath()
    ctx.arc(originScreen[0], originScreen[1], 4, 0, Math.PI * 2)
    ctx.fill()
  } else if (areCollinear) {
    // Collinear vectors: draw grid as lines along the direction of the vectors
    // All grid lines are parallel (the grid collapses to 1D)
    // Draw lines at integer intervals along u (they'll all be parallel in screen space)
    const startU = Math.floor(expandedMinU / gridStep) * gridStep
    const endU = Math.ceil(expandedMaxU / gridStep) * gridStep
    
    // Draw lines along the direction of the vectors
    // Each line is at a different u value, all parallel
    for (let u = startU; u <= endU; u += gridStep) {
      // Draw a long line in the direction of the vectors
      // Use a large range for v to ensure the line extends far
      const startScreen = transformToScreen([u, expandedMinV])
      const endScreen = transformToScreen([u, expandedMaxV])
      
      ctx.beginPath()
      ctx.moveTo(Math.round(startScreen[0]) + 0.5, Math.round(startScreen[1]) + 0.5)
      ctx.lineTo(Math.round(endScreen[0]) + 0.5, Math.round(endScreen[1]) + 0.5)
      ctx.stroke()
    }
  } else {
    // Normal case: draw full grid
    // Draw grid lines parallel to baseI (constant u, varying v)
    // These lines follow the direction of baseJ
    const startU = Math.floor(expandedMinU / gridStep) * gridStep
    const endU = Math.ceil(expandedMaxU / gridStep) * gridStep
    for (let u = startU; u <= endU; u += gridStep) {
      const startScreen = transformToScreen([u, expandedMinV])
      const endScreen = transformToScreen([u, expandedMaxV])
      
      ctx.beginPath()
      ctx.moveTo(Math.round(startScreen[0]) + 0.5, Math.round(startScreen[1]) + 0.5)
      ctx.lineTo(Math.round(endScreen[0]) + 0.5, Math.round(endScreen[1]) + 0.5)
      ctx.stroke()
    }

    // Draw grid lines parallel to baseJ (constant v, varying u)
    // These lines follow the direction of baseI
    const startV = Math.floor(expandedMinV / gridStep) * gridStep
    const endV = Math.ceil(expandedMaxV / gridStep) * gridStep
    for (let v = startV; v <= endV; v += gridStep) {
      const startScreen = transformToScreen([expandedMinU, v])
      const endScreen = transformToScreen([expandedMaxU, v])
      
      ctx.beginPath()
      ctx.moveTo(Math.round(startScreen[0]) + 0.5, Math.round(startScreen[1]) + 0.5)
      ctx.lineTo(Math.round(endScreen[0]) + 0.5, Math.round(endScreen[1]) + 0.5)
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 1.0
}

