import type { CoordinateFrame, ViewportState, Point2D } from '../types'
import { worldToScreen, screenToWorld } from '../utils/coordinates'
import {
  frameToScreen,
  nestedFrameToScreen,
  parentToFrame,
  screenToFrame,
} from './frameTransforms'

/**
 * Draw axes for a frame with labels
 * Axes are drawn in frame coordinates at the frame's origin
 */
export function drawFrameAxes(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
): void {
  const { bounds, viewport: frameViewport, baseI, baseJ } = frame
  
  // Check if base vectors are zero - skip labels for zero vectors individually
  const baseIMag = Math.sqrt(baseI[0] ** 2 + baseI[1] ** 2)
  const baseJMag = Math.sqrt(baseJ[0] ** 2 + baseJ[1] ** 2)
  const baseIIsZero = baseIMag < 1e-10
  const baseJIsZero = baseJMag < 1e-10
  const areZero = baseIIsZero && baseJIsZero

  // Grid spacing is 1.0 (integer intervals) in frame coordinates, matching the grid
  const gridStep = 1.0

  const topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
  const bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)

  const frameZoom = frameViewport.zoom
  const framePanX = frameViewport.x
  const framePanY = frameViewport.y

  // Use the same approach as drawFrameGrid to calculate visible frame coordinate range
  // Sample multiple points along the frame bounds and transform them to frame coordinates
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
  
  // Calculate padding using the same approach as drawFrameGrid
  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)
  
  const originScreen = transformToScreen([0, 0])
  const oneUnitUScreen = transformToScreen([1, 0])
  const oneUnitVScreen = transformToScreen([0, 1])
  
  const screenUnitsPerU = Math.abs(oneUnitUScreen[0] - originScreen[0])
  const screenUnitsPerV = Math.abs(oneUnitVScreen[1] - originScreen[1])
  const avgScreenUnitsPerFrameUnit = (screenUnitsPerU + screenUnitsPerV) / 2
  
  const frameScreenWidth = Math.abs(bottomRight[0] - topLeft[0])
  const frameScreenHeight = Math.abs(bottomRight[1] - topLeft[1])
  const maxScreenDimension = Math.max(frameScreenWidth, frameScreenHeight)
  
  const frameUnitsForScreen = avgScreenUnitsPerFrameUnit > 0 
    ? maxScreenDimension / avgScreenUnitsPerFrameUnit 
    : 10
  
  const frameRangeU = maxU - minU
  const frameRangeV = maxV - minV
  const maxRange = Math.max(frameRangeU, frameRangeV, frameUnitsForScreen)
  
  // Use generous padding: at least 3x the range or 20 units, whichever is larger
  const padding = Math.max(maxRange * 3, 20)
  
  const expandedMinU = minU - padding
  const expandedMaxU = maxU + padding
  const expandedMinV = minV - padding
  const expandedMaxV = maxV + padding
  
  // Use expanded range for labels (matching grid range)
  const minFrameX = expandedMinU
  const maxFrameX = expandedMaxU
  const minFrameY = expandedMinV
  const maxFrameY = expandedMaxV

  const originScreenAxes = frame.parentFrameId
    ? nestedFrameToScreen([0, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, 0], frame, viewport, canvasWidth, canvasHeight)
  
  const iAxisEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([1, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([1, 0], frame, viewport, canvasWidth, canvasHeight)
  const jAxisEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([0, 1], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, 1], frame, viewport, canvasWidth, canvasHeight)
  
  // Calculate axis directions in screen space
  const baseIDirX = iAxisEndScreen[0] - originScreenAxes[0]
  const baseIDirY = iAxisEndScreen[1] - originScreenAxes[1]
  const baseJDirX = jAxisEndScreen[0] - originScreenAxes[0]
  const baseJDirY = jAxisEndScreen[1] - originScreenAxes[1]
  
  // Calculate axis endpoints using the expanded visible range
  // Transform the expanded range corners to screen coordinates to find where axes should extend
  const expandedCorners: Point2D[] = [
    transformToScreen([expandedMinU, expandedMinV]), // bottom-left
    transformToScreen([expandedMaxU, expandedMinV]), // bottom-right
    transformToScreen([expandedMaxU, expandedMaxV]), // top-right
    transformToScreen([expandedMinU, expandedMaxV]), // top-left
  ]
  
  // Find the bounding box of the expanded visible area in screen coordinates
  let minScreenX = Infinity
  let maxScreenX = -Infinity
  let minScreenY = Infinity
  let maxScreenY = -Infinity
  
  for (const corner of expandedCorners) {
    minScreenX = Math.min(minScreenX, corner[0])
    maxScreenX = Math.max(maxScreenX, corner[0])
    minScreenY = Math.min(minScreenY, corner[1])
    maxScreenY = Math.max(maxScreenY, corner[1])
  }
  
  // Extend the bounding box slightly to ensure axes are fully visible
  const axisPadding = 50
  minScreenX -= axisPadding
  maxScreenX += axisPadding
  minScreenY -= axisPadding
  maxScreenY += axisPadding
  
  // Calculate X-axis (baseI direction) endpoints
  // The X-axis is the line through origin in the direction of baseI
  let xAxisStartScreen = originScreenAxes
  let xAxisEndScreen = originScreenAxes
  
  const baseIMagnitude = Math.sqrt(baseIDirX * baseIDirX + baseIDirY * baseIDirY)
  if (baseIMagnitude > 1e-10) {
    // Normalize baseI direction
    const baseINormX = baseIDirX / baseIMagnitude
    const baseINormY = baseIDirY / baseIMagnitude
    
    // Find intersections with the expanded bounding box
    // Test intersections with left, right, top, and bottom edges
    const intersections: Point2D[] = []
    
    // Left edge: x = minScreenX
    if (Math.abs(baseINormX) > 1e-10) {
      const t = (minScreenX - originScreenAxes[0]) / baseINormX
      const y = originScreenAxes[1] + t * baseINormY
      if (y >= minScreenY && y <= maxScreenY) {
        intersections.push([minScreenX, y])
      }
    }
    
    // Right edge: x = maxScreenX
    if (Math.abs(baseINormX) > 1e-10) {
      const t = (maxScreenX - originScreenAxes[0]) / baseINormX
      const y = originScreenAxes[1] + t * baseINormY
      if (y >= minScreenY && y <= maxScreenY) {
        intersections.push([maxScreenX, y])
      }
    }
    
    // Top edge: y = minScreenY
    if (Math.abs(baseINormY) > 1e-10) {
      const t = (minScreenY - originScreenAxes[1]) / baseINormY
      const x = originScreenAxes[0] + t * baseINormX
      if (x >= minScreenX && x <= maxScreenX) {
        intersections.push([x, minScreenY])
      }
    }
    
    // Bottom edge: y = maxScreenY
    if (Math.abs(baseINormY) > 1e-10) {
      const t = (maxScreenY - originScreenAxes[1]) / baseINormY
      const x = originScreenAxes[0] + t * baseINormX
      if (x >= minScreenX && x <= maxScreenX) {
        intersections.push([x, maxScreenY])
      }
    }
    
    // Find the two points furthest from origin (start and end)
    if (intersections.length >= 2) {
      // Sort by distance from origin
      intersections.sort((a, b) => {
        const distA = Math.hypot(a[0] - originScreenAxes[0], a[1] - originScreenAxes[1])
        const distB = Math.hypot(b[0] - originScreenAxes[0], b[1] - originScreenAxes[1])
        return distA - distB
      })
      xAxisStartScreen = intersections[0]
      xAxisEndScreen = intersections[intersections.length - 1]
    } else if (intersections.length === 1) {
      // Only one intersection, extend in both directions
      const dirX = intersections[0][0] - originScreenAxes[0]
      const dirY = intersections[0][1] - originScreenAxes[1]
      const dist = Math.hypot(dirX, dirY)
      if (dist > 1e-10) {
        const scale = 1000 // Large scale to extend beyond bounds
        xAxisStartScreen = [
          originScreenAxes[0] - (dirX / dist) * scale,
          originScreenAxes[1] - (dirY / dist) * scale
        ]
        xAxisEndScreen = [
          originScreenAxes[0] + (dirX / dist) * scale,
          originScreenAxes[1] + (dirY / dist) * scale
        ]
      }
    }
  }
  
  // Calculate Y-axis (baseJ direction) endpoints
  // The Y-axis is the line through origin in the direction of baseJ
  let yAxisStartScreen = originScreenAxes
  let yAxisEndScreen = originScreenAxes
  
  const baseJMagnitude = Math.sqrt(baseJDirX * baseJDirX + baseJDirY * baseJDirY)
  if (baseJMagnitude > 1e-10) {
    // Normalize baseJ direction
    const baseJNormX = baseJDirX / baseJMagnitude
    const baseJNormY = baseJDirY / baseJMagnitude
    
    // Find intersections with the expanded bounding box
    const intersections: Point2D[] = []
    
    // Left edge: x = minScreenX
    if (Math.abs(baseJNormX) > 1e-10) {
      const t = (minScreenX - originScreenAxes[0]) / baseJNormX
      const y = originScreenAxes[1] + t * baseJNormY
      if (y >= minScreenY && y <= maxScreenY) {
        intersections.push([minScreenX, y])
      }
    }
    
    // Right edge: x = maxScreenX
    if (Math.abs(baseJNormX) > 1e-10) {
      const t = (maxScreenX - originScreenAxes[0]) / baseJNormX
      const y = originScreenAxes[1] + t * baseJNormY
      if (y >= minScreenY && y <= maxScreenY) {
        intersections.push([maxScreenX, y])
      }
    }
    
    // Top edge: y = minScreenY
    if (Math.abs(baseJNormY) > 1e-10) {
      const t = (minScreenY - originScreenAxes[1]) / baseJNormY
      const x = originScreenAxes[0] + t * baseJNormX
      if (x >= minScreenX && x <= maxScreenX) {
        intersections.push([x, minScreenY])
      }
    }
    
    // Bottom edge: y = maxScreenY
    if (Math.abs(baseJNormY) > 1e-10) {
      const t = (maxScreenY - originScreenAxes[1]) / baseJNormY
      const x = originScreenAxes[0] + t * baseJNormX
      if (x >= minScreenX && x <= maxScreenX) {
        intersections.push([x, maxScreenY])
      }
    }
    
    // Find the two points furthest from origin (start and end)
    if (intersections.length >= 2) {
      // Sort by distance from origin
      intersections.sort((a, b) => {
        const distA = Math.hypot(a[0] - originScreenAxes[0], a[1] - originScreenAxes[1])
        const distB = Math.hypot(b[0] - originScreenAxes[0], b[1] - originScreenAxes[1])
        return distA - distB
      })
      yAxisStartScreen = intersections[0]
      yAxisEndScreen = intersections[intersections.length - 1]
    } else if (intersections.length === 1) {
      // Only one intersection, extend in both directions
      const dirX = intersections[0][0] - originScreenAxes[0]
      const dirY = intersections[0][1] - originScreenAxes[1]
      const dist = Math.hypot(dirX, dirY)
      if (dist > 1e-10) {
        const scale = 1000 // Large scale to extend beyond bounds
        yAxisStartScreen = [
          originScreenAxes[0] - (dirX / dist) * scale,
          originScreenAxes[1] - (dirY / dist) * scale
        ]
        yAxisEndScreen = [
          originScreenAxes[0] + (dirX / dist) * scale,
          originScreenAxes[1] + (dirY / dist) * scale
        ]
      }
    }
  }

  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(Math.round(xAxisStartScreen[0]) + 0.5, Math.round(xAxisStartScreen[1]) + 0.5)
  ctx.lineTo(Math.round(xAxisEndScreen[0]) + 0.5, Math.round(xAxisEndScreen[1]) + 0.5)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(Math.round(yAxisStartScreen[0]) + 0.5, Math.round(yAxisStartScreen[1]) + 0.5)
  ctx.lineTo(Math.round(yAxisEndScreen[0]) + 0.5, Math.round(yAxisEndScreen[1]) + 0.5)
  ctx.stroke()

  // Skip all labels only when both base vectors are zero
  if (areZero) {
    ctx.globalAlpha = 1.0
    return
  }

  // Set label colors (different from grid/axes) - use contrasting colors for each axis
  ctx.font = 'bold 11px sans-serif'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = 1.0

  // Calculate label spacing based on screen space
  // We need to determine how many frame coordinate units fit in minLabelSpacingPx pixels
  const minLabelSpacingPx = 40
  
  // Reuse transformToScreen and originScreen from padding calculation above
  const oneUnitXScreen = transformToScreen([1, 0])
  const oneUnitYScreen = transformToScreen([0, 1])
  
  const screenSpacingX = Math.abs(oneUnitXScreen[0] - originScreen[0])
  const screenSpacingY = Math.abs(oneUnitYScreen[1] - originScreen[1])
  const avgScreenSpacing = (screenSpacingX + screenSpacingY) / 2
  
  let labelSpacingMultiplier = 1
  if (avgScreenSpacing > 0 && avgScreenSpacing < minLabelSpacingPx) {
    labelSpacingMultiplier = Math.ceil(minLabelSpacingPx / avgScreenSpacing)
  }
  const labelSpacing = gridStep * labelSpacingMultiplier

  // Format number helper (same as canvasDrawing.ts)
  const formatNumber = (value: number): string => {
    if (Math.abs(value - Math.round(value)) < 0.0001) {
      return Math.round(value).toString()
    }
    
    const rounded = Math.round(value * 1000) / 1000
    return rounded.toString()
  }

  // Draw X-axis labels (baseI direction) only if baseI is not zero
  // Use orange/red color for X-axis labels (more contrasting)
  if (!baseIIsZero) {
    ctx.fillStyle = '#f97316' // Orange-500 for X-axis labels (more contrasting than blue)
    ctx.textAlign = 'center'
    const startXLabel = Math.floor(minFrameX / labelSpacing) * labelSpacing
    const endXLabel = Math.ceil(maxFrameX / labelSpacing) * labelSpacing
    for (let x = startXLabel; x <= endXLabel; x += labelSpacing) {
      if (Math.abs(x) < 0.001) continue
      
      const labelScreen = transformToScreen([x, 0])
      
      const labelText = formatNumber(x)
      ctx.fillText(labelText, labelScreen[0], labelScreen[1] + 15)
    }
  }

  // Draw Y-axis labels (baseJ direction) only if baseJ is not zero
  // Use green color for Y-axis labels
  if (!baseJIsZero) {
    ctx.fillStyle = '#10b981' // Emerald-500 for Y-axis labels
    ctx.textAlign = 'right'
    const startYLabel = Math.floor(minFrameY / labelSpacing) * labelSpacing
    const endYLabel = Math.ceil(maxFrameY / labelSpacing) * labelSpacing
    for (let y = startYLabel; y <= endYLabel; y += labelSpacing) {
      if (Math.abs(y) < 0.001) continue
      
      const labelScreen = transformToScreen([0, y])
      
      const labelText = formatNumber(y)
      ctx.fillText(labelText, labelScreen[0] - 8, labelScreen[1])
    }
  }

  // Draw origin label only if at least one base vector is non-zero
  // Use neutral gray color for origin label
  if (!baseIIsZero || !baseJIsZero) {
    ctx.fillStyle = '#64748b' // Slate-500 for origin label (neutral)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText('0', originScreenAxes[0] - 5, originScreenAxes[1] + 5)
  }

  ctx.globalAlpha = 1.0
}

