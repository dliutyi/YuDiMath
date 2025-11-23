import type { CoordinateFrame, ViewportState, Point2D, Vector } from '../types'
import { worldToScreen, screenToWorld } from '../utils/coordinates'
import { drawArrow } from '../utils/arrows'
import {
  frameToScreen,
  nestedFrameToScreen,
  parentToFrame,
  screenToFrame,
} from './frameTransforms'
import { getGridColorForLevel, getBackgroundColorForLevel } from './frameUtils'

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
  selectedFrameId: string | null = null,
  nestingLevel: number = 0
) {
  const { bounds } = frame
  const isSelected = frame.id === selectedFrameId

  // For nested frames, we need to transform bounds through parent frames
  // The bounds are stored in world coordinates, but for nested frames, they're relative to the parent
  // So we need to transform the corner points through the parent chain
  let topLeft: Point2D
  let bottomRight: Point2D
  
  if (frame.parentFrameId) {
    // Nested frame: transform bounds through parent coordinate system
    // Bounds are stored in parent's world coordinates
    const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
    if (parentFrame) {
      // Bounds are in parent's world coordinates
      // Convert bounds corners from parent world coordinates to parent frame coordinates
      const topLeftParentWorld: Point2D = [bounds.x, bounds.y + bounds.height]
      const bottomRightParentWorld: Point2D = [bounds.x + bounds.width, bounds.y]
      
      // Convert parent world coordinates to parent frame coordinates (raw, no viewport)
      const topLeftParentFrame = parentToFrame(topLeftParentWorld, parentFrame)
      const bottomRightParentFrame = parentToFrame(bottomRightParentWorld, parentFrame)
      
      // Apply parent frame's viewport transformation
      const topLeftFrameWithViewport: Point2D = [
        (topLeftParentFrame[0] - parentFrame.viewport.x) * parentFrame.viewport.zoom,
        (topLeftParentFrame[1] - parentFrame.viewport.y) * parentFrame.viewport.zoom
      ]
      const bottomRightFrameWithViewport: Point2D = [
        (bottomRightParentFrame[0] - parentFrame.viewport.x) * parentFrame.viewport.zoom,
        (bottomRightParentFrame[1] - parentFrame.viewport.y) * parentFrame.viewport.zoom
      ]
      
      // Transform back to parent world coordinates using parent frame's base vectors
      const [originX, originY] = parentFrame.origin
      const [iX, iY] = parentFrame.baseI
      const [jX, jY] = parentFrame.baseJ
      
      const topLeftParentWorldWithViewport: Point2D = [
        originX + topLeftFrameWithViewport[0] * iX + topLeftFrameWithViewport[1] * jX,
        originY + topLeftFrameWithViewport[0] * iY + topLeftFrameWithViewport[1] * jY
      ]
      const bottomRightParentWorldWithViewport: Point2D = [
        originX + bottomRightFrameWithViewport[0] * iX + bottomRightFrameWithViewport[1] * jX,
        originY + bottomRightFrameWithViewport[0] * iY + bottomRightFrameWithViewport[1] * jY
      ]
      
      // Transform to screen using root viewport
      topLeft = worldToScreen(topLeftParentWorldWithViewport[0], topLeftParentWorldWithViewport[1], viewport, canvasWidth, canvasHeight)
      bottomRight = worldToScreen(bottomRightParentWorldWithViewport[0], bottomRightParentWorldWithViewport[1], viewport, canvasWidth, canvasHeight)
    } else {
      // Parent not found, fall back to direct transformation
      topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
      bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)
    }
  } else {
    // Top-level frame: use direct world-to-screen transformation
    topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
    bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)
  }
  
  // Calculate origin in screen coordinates
  const originScreen = frame.parentFrameId
    ? nestedFrameToScreen([0, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, 0], frame, viewport, canvasWidth, canvasHeight)

  // Draw frame background with semi-transparent color
  ctx.fillStyle = getBackgroundColorForLevel(nestingLevel)
  ctx.beginPath()
  ctx.rect(
    Math.round(topLeft[0]) + 0.5,
    Math.round(topLeft[1]) + 0.5,
    bottomRight[0] - topLeft[0],
    bottomRight[1] - topLeft[1]
  )
  ctx.fill()

  // Draw frame border with different style if selected
  ctx.strokeStyle = isSelected ? '#3b82f6' : '#60a5fa'
  ctx.lineWidth = isSelected ? 3 : 2
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.rect(
    Math.round(topLeft[0]) + 0.5,
    Math.round(topLeft[1]) + 0.5,
    bottomRight[0] - topLeft[0],
    bottomRight[1] - topLeft[1]
  )
  ctx.stroke()

  // Draw frame grid, axes, and base vectors - all clipped to frame bounds
  ctx.save()
  
  // For nested frames, clip to parent bounds first
  if (frame.parentFrameId) {
    const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
    if (parentFrame) {
      let parentTopLeft: Point2D
      let parentBottomRight: Point2D
      
      if (parentFrame.parentFrameId) {
        const parentBounds = parentFrame.bounds
        const parentTopLeftWorld: Point2D = [parentBounds.x, parentBounds.y + parentBounds.height]
        const parentBottomRightWorld: Point2D = [parentBounds.x + parentBounds.width, parentBounds.y]
        const parentTopLeftFrame = parentToFrame(parentTopLeftWorld, parentFrame)
        const parentBottomRightFrame = parentToFrame(parentBottomRightWorld, parentFrame)
        parentTopLeft = nestedFrameToScreen(parentTopLeftFrame, parentFrame, allFrames, viewport, canvasWidth, canvasHeight)
        parentBottomRight = nestedFrameToScreen(parentBottomRightFrame, parentFrame, allFrames, viewport, canvasWidth, canvasHeight)
      } else {
        parentTopLeft = worldToScreen(parentFrame.bounds.x, parentFrame.bounds.y + parentFrame.bounds.height, viewport, canvasWidth, canvasHeight)
        parentBottomRight = worldToScreen(parentFrame.bounds.x + parentFrame.bounds.width, parentFrame.bounds.y, viewport, canvasWidth, canvasHeight)
      }
      
      ctx.beginPath()
      ctx.rect(
        Math.round(parentTopLeft[0]) + 0.5,
        Math.round(parentTopLeft[1]) + 0.5,
        parentBottomRight[0] - parentTopLeft[0],
        parentBottomRight[1] - parentTopLeft[1]
      )
      ctx.clip()
    }
  }
  
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
  drawFrameGrid(ctx, frame, viewport, canvasWidth, canvasHeight, nestingLevel, allFrames)
  
  // Draw frame axes with labels
  drawFrameAxes(ctx, frame, viewport, canvasWidth, canvasHeight, allFrames)
  
  // Draw base vectors within clipped region
  const baseVectorScale = 1.0
  const baseIEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([baseVectorScale, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([baseVectorScale, 0], frame, viewport, canvasWidth, canvasHeight)
  const baseJEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([0, baseVectorScale], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, baseVectorScale], frame, viewport, canvasWidth, canvasHeight)

  drawArrow(ctx, originScreen, baseIEndScreen, '#ef4444', 2, 8)
  drawArrow(ctx, originScreen, baseJEndScreen, '#3b82f6', 2, 8)
  
  // Draw vectors within clipped region
  drawFrameVectors(ctx, frame, viewport, canvasWidth, canvasHeight, allFrames)
  
  // Recursively draw child frames
  frame.childFrameIds.forEach(childId => {
    const childFrame = allFrames.find(f => f.id === childId)
    if (childFrame) {
      drawCoordinateFrame(ctx, childFrame, viewport, canvasWidth, canvasHeight, allFrames, selectedFrameId, nestingLevel + 1)
    }
  })
  
  ctx.restore()
}

/**
 * Draw the coordinate grid for a frame
 * Grid lines follow the directions of baseI and baseJ
 * Grid is drawn at integer intervals (1, 2, 3, ...) in frame coordinates
 * The base vectors themselves determine how these transform to screen space
 */
function drawFrameGrid(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  nestingLevel: number = 0,
  allFrames: CoordinateFrame[] = []
) {
  const { bounds, viewport: frameViewport } = frame

  const gridColor = getGridColorForLevel(nestingLevel)
  
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.7
  ctx.setLineDash([])

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

  ctx.globalAlpha = 1.0
}

/**
 * Draw axes for a frame with labels
 * Axes are drawn in frame coordinates at the frame's origin
 */
function drawFrameAxes(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
) {
  const { bounds, viewport: frameViewport } = frame

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

  ctx.fillStyle = '#cbd5e1'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
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

  const startXLabel = Math.floor(minFrameX / labelSpacing) * labelSpacing
  const endXLabel = Math.ceil(maxFrameX / labelSpacing) * labelSpacing
  for (let x = startXLabel; x <= endXLabel; x += labelSpacing) {
    if (Math.abs(x) < 0.001) continue
    
    const labelScreen = transformToScreen([x, 0])
    
    const labelText = formatNumber(x)
    ctx.fillText(labelText, labelScreen[0], labelScreen[1] + 15)
  }

  const startYLabel = Math.floor(minFrameY / labelSpacing) * labelSpacing
  const endYLabel = Math.ceil(maxFrameY / labelSpacing) * labelSpacing
  for (let y = startYLabel; y <= endYLabel; y += labelSpacing) {
    if (Math.abs(y) < 0.001) continue
    
    const labelScreen = transformToScreen([0, y])
    
    const labelText = formatNumber(y)
    ctx.textAlign = 'right'
    ctx.fillText(labelText, labelScreen[0] - 8, labelScreen[1])
  }

  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('0', originScreenAxes[0] - 5, originScreenAxes[1] + 5)

  ctx.globalAlpha = 1.0
}

/**
 * Draw vectors defined in a frame
 * Vectors are drawn in frame coordinates and transformed to screen coordinates
 */
function drawFrameVectors(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
) {
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

