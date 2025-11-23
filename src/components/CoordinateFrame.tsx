import type { CoordinateFrame, ViewportState, Point2D } from '../types'
import { worldToScreen } from '../utils/coordinates'
import { drawArrow } from '../utils/arrows'

/**
 * Transform a point from frame coordinates to screen coordinates
 * Accounts for frame's viewport pan and zoom
 * @param point Point in frame coordinates [u, v]
 * @param frame The coordinate frame
 * @param parentViewport Parent viewport state
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Point in screen coordinates [x, y]
 */
function frameToScreen(
  point: Point2D,
  frame: CoordinateFrame,
  parentViewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  const [u, v] = point
  const { viewport: frameViewport } = frame
  
  // Apply frame viewport pan and zoom
  // Frame viewport pan (framePanX, framePanY) shifts what's visible in frame coordinates
  // Frame viewport zoom scales the visible area (higher zoom = see less space, more detail)
  // 
  // To transform frame coordinate (u, v) to screen:
  // 1. Account for frame pan: (u - framePanX, v - framePanY)
  // 2. Transform to parent coordinates using base vectors scaled by frame zoom
  //    - Higher zoom means base vectors appear larger (more pixels per unit)
  //    - So we scale base vectors by frame zoom
  // 3. Transform to screen coordinates using parent viewport
  
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Apply frame pan
  const frameU = u - frameViewport.x
  const frameV = v - frameViewport.y
  
  // Apply frame zoom to scale the frame coordinate space
  // Frame zoom is independent of parent zoom - it only affects the frame's internal coordinate system
  // Higher zoom = see less space = more detail (1 unit in frame coordinates takes more pixels)
  const scaledU = frameU * frameViewport.zoom
  const scaledV = frameV * frameViewport.zoom
  
  // Transform to parent coordinates using base vectors
  // Base vectors define the coordinate system, so we use them as-is
  const parentX = originX + scaledU * iX + scaledV * jX
  const parentY = originY + scaledU * iY + scaledV * jY
  
  // Transform to screen coordinates using parent viewport
  // Parent zoom only affects frame position on screen, not frame content (which is already scaled by frame zoom)
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  const screenX = centerX + (parentX - parentViewport.x) * parentViewport.zoom
  const screenY = centerY - (parentY - parentViewport.y) * parentViewport.zoom
  
  return [screenX, screenY]
}

/**
 * Transform a point from screen coordinates to frame coordinates
 * Inverse of frameToScreen
 * @param screenPoint Point in screen coordinates [x, y]
 * @param frame The coordinate frame
 * @param parentViewport Parent viewport state
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Point in frame coordinates [u, v]
 */
export function screenToFrame(
  screenPoint: Point2D,
  frame: CoordinateFrame,
  parentViewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  const [screenX, screenY] = screenPoint
  const { viewport: frameViewport } = frame
  
  // Transform from screen to parent coordinates
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  const parentX = parentViewport.x + (screenX - centerX) / parentViewport.zoom
  const parentY = parentViewport.y - (screenY - centerY) / parentViewport.zoom
  
  // Transform from parent coordinates to frame coordinates
  // We need to solve: parent = origin + scaledU * baseI + scaledV * baseJ
  // Where scaledU = (u - framePanX) * frameZoom and scaledV = (v - framePanY) * frameZoom
  
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Relative to frame origin
  const relX = parentX - originX
  const relY = parentY - originY
  
  // Solve for scaledU and scaledV using the inverse transformation
  // We have: relX = scaledU * iX + scaledV * jX
  //          relY = scaledU * iY + scaledV * jY
  // This is a 2x2 system: [iX jX] [scaledU] = [relX]
  //                      [iY jY] [scaledV]   [relY]
  
  const determinant = iX * jY - iY * jX
  if (Math.abs(determinant) < 1e-10) {
    // Base vectors are parallel or zero, can't invert
    return [0, 0]
  }
  
  const scaledU = (relX * jY - relY * jX) / determinant
  const scaledV = (relY * iX - relX * iY) / determinant
  
  // Undo frame zoom
  const frameU = scaledU / frameViewport.zoom
  const frameV = scaledV / frameViewport.zoom
  
  // Undo frame pan
  const u = frameU + frameViewport.x
  const v = frameV + frameViewport.y
  
  return [u, v]
}

/**
 * Transform a point from frame coordinates to parent (world) coordinates
 * @param point Point in frame coordinates [u, v]
 * @param frame The coordinate frame
 * @returns Point in parent (world) coordinates [x, y]
 */
/**
 * Transform a point from frame coordinates to parent (world) coordinates
 * Applies frame viewport pan/zoom before transforming
 * This is used when rendering - frame coordinates account for viewport
 */
export function frameToParent(point: Point2D, frame: CoordinateFrame): Point2D {
  const [u, v] = point
  const { viewport: frameViewport } = frame
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Apply frame viewport pan/zoom, then transform using base vectors
  // This matches the inverse of frameToScreen
  const frameU = u - frameViewport.x
  const frameV = v - frameViewport.y
  const scaledU = frameU * frameViewport.zoom
  const scaledV = frameV * frameViewport.zoom
  const parentX = originX + scaledU * iX + scaledV * jX
  const parentY = originY + scaledU * iY + scaledV * jY
  
  return [parentX, parentY]
}

/**
 * Transform a point from frame coordinates to parent (world) coordinates
 * WITHOUT applying frame viewport pan/zoom
 * This is used when creating new frames - we want raw coordinate transformation
 */
export function frameCoordsToParentWorld(point: Point2D, frame: CoordinateFrame): Point2D {
  const [u, v] = point
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Direct transformation without viewport pan/zoom
  // This is used when storing bounds for newly created frames
  const parentX = originX + u * iX + v * jX
  const parentY = originY + u * iY + v * jY
  
  return [parentX, parentY]
}

/**
 * Draw a coordinate frame on the canvas
 * This function is called from the Canvas component's draw function
 */
/**
 * Get grid color for a given nesting level
 * Each level gets a distinct color that contrasts with its parent
 */
function getGridColorForLevel(level: number): string {
  // Color palette for different nesting levels
  // Colors chosen to provide good contrast with each other
  const colors = [
    '#6366f1', // indigo-500 - level 0 (top-level frames)
    '#ec4899', // pink-500 - level 1
    '#10b981', // emerald-500 - level 2
    '#f59e0b', // amber-500 - level 3
    '#8b5cf6', // violet-500 - level 4
    '#06b6d4', // cyan-500 - level 5
    '#ef4444', // red-500 - level 6
    '#14b8a6', // teal-500 - level 7
  ]
  
  // Cycle through colors if nesting is deeper than palette
  return colors[level % colors.length]
}

/**
 * Get background color for a given nesting level
 * Each level gets a distinct semi-transparent background tint
 */
function getBackgroundColorForLevel(level: number): string {
  // Background color palette matching grid colors but with low opacity
  const backgroundColors = [
    'rgba(99, 102, 241, 0.08)',   // indigo tint - level 0
    'rgba(236, 72, 153, 0.08)',   // pink tint - level 1
    'rgba(16, 185, 129, 0.08)',   // emerald tint - level 2
    'rgba(245, 158, 11, 0.08)',   // amber tint - level 3
    'rgba(139, 92, 246, 0.08)',   // violet tint - level 4
    'rgba(6, 182, 212, 0.08)',    // cyan tint - level 5
    'rgba(239, 68, 68, 0.08)',    // red tint - level 6
    'rgba(20, 184, 166, 0.08)',   // teal tint - level 7
  ]
  
  // Cycle through colors if nesting is deeper than palette
  return backgroundColors[level % backgroundColors.length]
}

/**
 * Transform a point from a nested frame's coordinate system to screen coordinates
 * Recursively transforms through all parent frames
 */
export function nestedFrameToScreen(
  point: Point2D,
  frame: CoordinateFrame,
  allFrames: CoordinateFrame[],
  rootViewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  // If this frame has a parent, transform through the parent first
  if (frame.parentFrameId) {
    const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
    if (parentFrame) {
      // Transform point from this frame's coordinate system to parent's coordinate system
      // Step 1: Convert from this frame's coordinates to parent's world coordinates
      // frameToParent applies this frame's viewport pan/zoom, then transforms using base vectors
      const parentWorldPoint = frameToParent(point, frame)
      
      // Step 2: Convert from parent's world coordinates to parent's frame coordinates
      // parentToFrame does NOT apply viewport - it's just the coordinate transformation
      const parentFramePoint = parentToFrame(parentWorldPoint, parentFrame)
      
      // Step 3: Recursively transform through parent (which will apply parent's viewport)
      return nestedFrameToScreen(parentFramePoint, parentFrame, allFrames, rootViewport, canvasWidth, canvasHeight)
    }
  }
  
  // No parent (or parent not found), transform directly using this frame
  // frameToScreen applies this frame's viewport pan/zoom and transforms to screen
  return frameToScreen(point, frame, rootViewport, canvasWidth, canvasHeight)
}

/**
 * Transform a point from parent (world) coordinates to frame coordinates
 * Inverse of frameToParent (without viewport pan/zoom)
 * This is used for converting world coordinates to frame coordinates for rendering
 */
export function parentToFrame(point: Point2D, frame: CoordinateFrame): Point2D {
  const [px, py] = point
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Relative to frame origin
  const relX = px - originX
  const relY = py - originY
  
  // Solve for u, v using inverse transformation
  // We have: relX = u * iX + v * jX
  //          relY = u * iY + v * jY
  const determinant = iX * jY - iY * jX
  if (Math.abs(determinant) < 1e-10) {
    return [0, 0]
  }
  
  const u = (relX * jY - relY * jX) / determinant
  const v = (relY * iX - relX * iY) / determinant
  
  return [u, v]
}

/**
 * Transform a point from parent (world) coordinates to frame coordinates
 * WITHOUT applying frame viewport pan/zoom
 * This is used when creating new frames - we want raw coordinate transformation
 */
export function parentWorldToFrameCoords(point: Point2D, frame: CoordinateFrame): Point2D {
  return parentToFrame(point, frame)
}

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
    // We need to convert them to this frame's coordinate system first, then transform to screen
    const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
    if (parentFrame) {
      // Bounds are in parent's world coordinates
      // Convert bounds corners from parent world coordinates to parent frame coordinates
      const topLeftParentWorld: Point2D = [bounds.x, bounds.y + bounds.height]
      const bottomRightParentWorld: Point2D = [bounds.x + bounds.width, bounds.y]
      
      const topLeftParentFrame = parentToFrame(topLeftParentWorld, parentFrame)
      const bottomRightParentFrame = parentToFrame(bottomRightParentWorld, parentFrame)
      
      // Now convert from parent frame coordinates to this frame's coordinates
      // The bounds corners in parent frame coords need to be converted to this frame's world coords
      // then to this frame's frame coords
      const topLeftThisFrameWorld = frameCoordsToParentWorld(topLeftParentFrame, parentFrame)
      const bottomRightThisFrameWorld = frameCoordsToParentWorld(bottomRightParentFrame, parentFrame)
      
      // Convert to this frame's frame coordinates
      const topLeftThisFrame = parentToFrame(topLeftThisFrameWorld, frame)
      const bottomRightThisFrame = parentToFrame(bottomRightThisFrameWorld, frame)
      
      // Then transform through this frame's chain to screen
      topLeft = nestedFrameToScreen(topLeftThisFrame, frame, allFrames, viewport, canvasWidth, canvasHeight)
      bottomRight = nestedFrameToScreen(bottomRightThisFrame, frame, allFrames, viewport, canvasWidth, canvasHeight)
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
  // The origin in frame coordinates is (0, 0)
  // For nested frames, transform through parent chain
  const originScreen = frame.parentFrameId
    ? nestedFrameToScreen([0, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, 0], frame, viewport, canvasWidth, canvasHeight)

  // Draw frame background with semi-transparent color
  // This provides visual separation while still showing parent grid
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

  // Draw frame grid, axes, and base vectors - all clipped to frame bounds
  // Save context state before clipping
  ctx.save()
  
  // For nested frames, we need to clip to both the frame bounds AND the parent's bounds
  // First, clip to parent bounds if this is a nested frame
  if (frame.parentFrameId) {
    const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
    if (parentFrame) {
      // Get parent frame bounds in screen coordinates
      // We need to recursively get parent bounds through the parent chain
      let parentTopLeft: Point2D
      let parentBottomRight: Point2D
      
      if (parentFrame.parentFrameId) {
        // Parent is also nested - use nested transformation
        const parentBounds = parentFrame.bounds
        const parentTopLeftWorld: Point2D = [parentBounds.x, parentBounds.y + parentBounds.height]
        const parentBottomRightWorld: Point2D = [parentBounds.x + parentBounds.width, parentBounds.y]
        const parentTopLeftFrame = parentToFrame(parentTopLeftWorld, parentFrame)
        const parentBottomRightFrame = parentToFrame(parentBottomRightWorld, parentFrame)
        parentTopLeft = nestedFrameToScreen(parentTopLeftFrame, parentFrame, allFrames, viewport, canvasWidth, canvasHeight)
        parentBottomRight = nestedFrameToScreen(parentBottomRightFrame, parentFrame, allFrames, viewport, canvasWidth, canvasHeight)
      } else {
        // Parent is top-level
        parentTopLeft = worldToScreen(parentFrame.bounds.x, parentFrame.bounds.y + parentFrame.bounds.height, viewport, canvasWidth, canvasHeight)
        parentBottomRight = worldToScreen(parentFrame.bounds.x + parentFrame.bounds.width, parentFrame.bounds.y, viewport, canvasWidth, canvasHeight)
      }
      
      // Clip to parent bounds first (intersection)
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
  
  // Clip drawing to frame bounds (intersection with parent bounds if nested)
  ctx.beginPath()
  ctx.rect(
    Math.round(topLeft[0]) + 0.5,
    Math.round(topLeft[1]) + 0.5,
    bottomRight[0] - topLeft[0],
    bottomRight[1] - topLeft[1]
  )
  ctx.clip()
  
  // Draw grid within clipped region with color based on nesting level
  drawFrameGrid(ctx, frame, viewport, canvasWidth, canvasHeight, nestingLevel, allFrames)
  
  // Draw frame axes with labels
  drawFrameAxes(ctx, frame, viewport, canvasWidth, canvasHeight, allFrames)
  
  // Draw base vectors within clipped region
  // Base vectors are 1 unit in frame coordinates
  // For nested frames, transform through parent chain
  const baseVectorScale = 1.0 // 1 unit in frame coordinates
  const baseIEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([baseVectorScale, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([baseVectorScale, 0], frame, viewport, canvasWidth, canvasHeight)
  const baseJEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([0, baseVectorScale], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, baseVectorScale], frame, viewport, canvasWidth, canvasHeight)

  // Draw base i vector (red) as arrow
  drawArrow(ctx, originScreen, baseIEndScreen, '#ef4444', 2, 8)

  // Draw base j vector (blue) as arrow
  drawArrow(ctx, originScreen, baseJEndScreen, '#3b82f6', 2, 8)
  
  // Recursively draw child frames with incremented nesting level
  // Children are drawn within the current clipping region (this frame's bounds, and parent's bounds if nested)
  // Each child will set up additional clipping to its own bounds
  frame.childFrameIds.forEach(childId => {
    const childFrame = allFrames.find(f => f.id === childId)
    if (childFrame) {
      // Child will set up its own clipping (which will be intersection with current clip)
      drawCoordinateFrame(ctx, childFrame, viewport, canvasWidth, canvasHeight, allFrames, selectedFrameId, nestingLevel + 1)
    }
  })
  
  // Restore context state (removes clip) after drawing all children
  ctx.restore()
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
  canvasHeight: number,
  nestingLevel: number = 0,
  allFrames: CoordinateFrame[] = []
) {
  const { bounds, baseI, baseJ, viewport: frameViewport } = frame

  // Calculate grid step based on base vector magnitudes
  // Grid step should be 1 unit in frame coordinates, which corresponds to base vector magnitudes
  // Use the average magnitude of baseI and baseJ as the grid step
  const iMagnitude = Math.sqrt(baseI[0] ** 2 + baseI[1] ** 2)
  const jMagnitude = Math.sqrt(baseJ[0] ** 2 + baseJ[1] ** 2)
  const avgMagnitude = (iMagnitude + jMagnitude) / 2
  
  // Grid step is 1 unit in frame coordinates
  // In parent coordinates, 1 unit in frame coordinates = avgMagnitude
  const gridStep = avgMagnitude > 0 ? avgMagnitude : 1.0

  // Get color for this nesting level - each level has a distinct color
  const gridColor = getGridColorForLevel(nestingLevel)
  
  // Frame grids should have high contrast and be more opaque for visibility
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.7 // More opaque for better contrast
  ctx.setLineDash([])

  // Convert frame bounds to screen coordinates
  const topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
  const bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)
  const frameScreenWidth = bottomRight[0] - topLeft[0]
  const frameScreenHeight = bottomRight[1] - topLeft[1]

  // Account for frame's own viewport (pan and zoom)
  const frameZoom = frameViewport.zoom
  const framePanX = frameViewport.x
  const framePanY = frameViewport.y

  // Calculate visible range in frame coordinates
  // Frame center in frame coordinates is at (0, 0) accounting for pan
  // The frame zoom affects how much of the frame coordinate space is visible
  // We need to account for how frame coordinates map to parent coordinates
  // 1 unit in frame coordinates = base vector magnitude in parent coordinates
  // Then parent coordinates are scaled by (parent zoom * frame zoom) to screen
  const parentZoom = viewport.zoom
  // Combined scale: frame coordinate -> parent coordinate -> screen
  // gridStep is the base vector magnitude, so frame coordinate -> parent is gridStep
  // parent -> screen is parentZoom * frameZoom
  const frameToScreenScale = gridStep * frameZoom * parentZoom
  
  const halfFrameWidth = (frameScreenWidth / frameToScreenScale) / 2
  const halfFrameHeight = (frameScreenHeight / frameToScreenScale) / 2

  const minU = -halfFrameWidth - framePanX
  const maxU = halfFrameWidth - framePanX
  const minV = -halfFrameHeight - framePanY
  const maxV = halfFrameHeight - framePanY
  
  // Expand range significantly to ensure infinite grid appearance during panning
  // Use a large padding based on frame screen dimensions to ensure grid extends far beyond visible area
  const padding = Math.max(frameScreenWidth, frameScreenHeight) / frameToScreenScale * 3
  const expandedMinU = minU - padding
  const expandedMaxU = maxU + padding
  const expandedMinV = minV - padding
  const expandedMaxV = maxV + padding

  // Draw grid lines along baseI direction (lines parallel to baseJ)
  // These are lines at constant u values
  // Helper to transform frame coordinates to screen (accounting for parent chain if nested)
  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)
  
  const startU = Math.floor(expandedMinU / gridStep) * gridStep
  const endU = Math.ceil(expandedMaxU / gridStep) * gridStep
  for (let u = startU; u <= endU; u += gridStep) {
    // Line endpoints in frame coordinates: (u, expandedMinV) to (u, expandedMaxV)
    // Use transformToScreen to account for frame viewport zoom and pan (and parent chain if nested)
    const startScreen = transformToScreen([u, expandedMinV])
    const endScreen = transformToScreen([u, expandedMaxV])
    
    ctx.beginPath()
    ctx.moveTo(Math.round(startScreen[0]) + 0.5, Math.round(startScreen[1]) + 0.5)
    ctx.lineTo(Math.round(endScreen[0]) + 0.5, Math.round(endScreen[1]) + 0.5)
    ctx.stroke()
  }

  // Draw grid lines along baseJ direction (lines parallel to baseI)
  // These are lines at constant v values
  const startV = Math.floor(expandedMinV / gridStep) * gridStep
  const endV = Math.ceil(expandedMaxV / gridStep) * gridStep
  for (let v = startV; v <= endV; v += gridStep) {
    // Line endpoints in frame coordinates: (expandedMinU, v) to (expandedMaxU, v)
    // Use transformToScreen to account for frame viewport zoom and pan (and parent chain if nested)
    const startScreen = transformToScreen([expandedMinU, v])
    const endScreen = transformToScreen([expandedMaxU, v])
    
    ctx.beginPath()
    ctx.moveTo(Math.round(startScreen[0]) + 0.5, Math.round(startScreen[1]) + 0.5)
    ctx.lineTo(Math.round(endScreen[0]) + 0.5, Math.round(endScreen[1]) + 0.5)
    ctx.stroke()
  }

  // Restore global alpha
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
  const { bounds, baseI, baseJ, viewport: frameViewport } = frame

  // Calculate grid step based on base vector magnitudes
  const iMagnitude = Math.sqrt(baseI[0] ** 2 + baseI[1] ** 2)
  const jMagnitude = Math.sqrt(baseJ[0] ** 2 + baseJ[1] ** 2)
  const avgMagnitude = (iMagnitude + jMagnitude) / 2
  const gridStep = avgMagnitude > 0 ? avgMagnitude : 1.0

  // Convert frame bounds to screen coordinates
  const topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
  const bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)

  // Frame viewport dimensions in screen coordinates
  const frameScreenWidth = bottomRight[0] - topLeft[0]
  const frameScreenHeight = bottomRight[1] - topLeft[1]

  // Calculate frame coordinate system bounds in frame coordinates
  // Account for frame's own viewport (pan and zoom)
  const frameZoom = frameViewport.zoom
  const framePanX = frameViewport.x
  const framePanY = frameViewport.y
  const parentZoomAxes = viewport.zoom
  const frameToScreenScaleAxes = gridStep * frameZoom * parentZoomAxes
  const halfFrameWidth = (frameScreenWidth / frameToScreenScaleAxes) / 2
  const halfFrameHeight = (frameScreenHeight / frameToScreenScaleAxes) / 2
  // Calculate visible range in frame coordinates, accounting for panning
  // Expand significantly to ensure labels appear when panning far
  const paddingForLabels = Math.max(frameScreenWidth, frameScreenHeight) / frameToScreenScaleAxes * 3
  const minFrameX = -halfFrameWidth - framePanX - paddingForLabels
  const maxFrameX = halfFrameWidth - framePanX + paddingForLabels
  const minFrameY = -halfFrameHeight - framePanY - paddingForLabels
  const maxFrameY = halfFrameHeight - framePanY + paddingForLabels

  // Axes should always be fixed at the origin (0, 0) in frame coordinates
  // They extend from the origin to the frame edges, regardless of panning
  // The origin in frame coordinates is always at (0, 0), which maps to frame.origin in parent coordinates
  
  // Calculate frame corners in screen coordinates
  const topLeftScreen = topLeft
  const topRightScreen = [bottomRight[0], topLeft[1]]
  const bottomLeftScreen = [topLeft[0], bottomRight[1]]
  const bottomRightScreen = bottomRight
  
  // Origin in screen coordinates
  // The origin in frame coordinates is (0, 0), which maps to frame.origin in parent coordinates
  // When panning within the frame, this screen position changes because we're seeing a different part of the frame
  // For nested frames, transform through parent chain
  const originScreenAxes = frame.parentFrameId
    ? nestedFrameToScreen([0, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, 0], frame, viewport, canvasWidth, canvasHeight)
  
  // Get base vector directions in screen coordinates
  // The axes should always pass through the frame origin (0, 0 in frame coordinates)
  // Base vectors define the direction of the axes
  // We calculate the direction by transforming points (1, 0) and (0, 1) in frame coordinates to screen
  // This correctly accounts for frame panning and zooming
  
  // Transform unit vectors in frame coordinates to screen coordinates
  // (1, 0) in frame coordinates gives us the direction of the i-axis
  // (0, 1) in frame coordinates gives us the direction of the j-axis
  // For nested frames, transform through parent chain
  const iAxisEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([1, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([1, 0], frame, viewport, canvasWidth, canvasHeight)
  const jAxisEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([0, 1], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, 1], frame, viewport, canvasWidth, canvasHeight)
  
  // Calculate direction vectors in screen space (from origin)
  const baseIDirX = iAxisEndScreen[0] - originScreenAxes[0]
  const baseIDirY = iAxisEndScreen[1] - originScreenAxes[1]
  const baseJDirX = jAxisEndScreen[0] - originScreenAxes[0]
  const baseJDirY = jAxisEndScreen[1] - originScreenAxes[1]
  
  // Find X axis endpoints (intersection with left and right edges)
  // X axis goes through the fixed origin, parallel to baseI direction
  let xAxisStartScreen = originScreenAxes
  let xAxisEndScreen = originScreenAxes
  
  if (Math.abs(baseIDirX) > 0.001) {
    // Find intersection with left edge (x = topLeft[0])
    const tLeft = (topLeftScreen[0] - originScreenAxes[0]) / baseIDirX
    const yLeft = originScreenAxes[1] + tLeft * baseIDirY
    if (yLeft >= topLeftScreen[1] && yLeft <= bottomLeftScreen[1]) {
      xAxisStartScreen = [topLeftScreen[0], yLeft]
    }
    
    // Find intersection with right edge (x = bottomRight[0])
    const tRight = (bottomRightScreen[0] - originScreenAxes[0]) / baseIDirX
    const yRight = originScreenAxes[1] + tRight * baseIDirY
    if (yRight >= topRightScreen[1] && yRight <= bottomRightScreen[1]) {
      xAxisEndScreen = [bottomRightScreen[0], yRight]
    }
  }
  
  // Find Y axis endpoints (intersection with top and bottom edges)
  // Y axis goes through the fixed origin, parallel to baseJ direction
  let yAxisStartScreen = originScreenAxes
  let yAxisEndScreen = originScreenAxes
  
  if (Math.abs(baseJDirY) > 0.001) {
    // Find intersection with top edge (y = topLeft[1])
    const tTop = (topLeftScreen[1] - originScreenAxes[1]) / baseJDirY
    const xTop = originScreenAxes[0] + tTop * baseJDirX
    if (xTop >= topLeftScreen[0] && xTop <= topRightScreen[0]) {
      yAxisStartScreen = [xTop, topLeftScreen[1]]
    }
    
    // Find intersection with bottom edge (y = bottomRight[1])
    const tBottom = (bottomRightScreen[1] - originScreenAxes[1]) / baseJDirY
    const xBottom = originScreenAxes[0] + tBottom * baseJDirX
    if (xBottom >= bottomLeftScreen[0] && xBottom <= bottomRightScreen[0]) {
      yAxisEndScreen = [xBottom, bottomRightScreen[1]]
    }
  }

  ctx.strokeStyle = '#64748b' // axis color
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(Math.round(xAxisStartScreen[0]) + 0.5, Math.round(xAxisStartScreen[1]) + 0.5)
  ctx.lineTo(Math.round(xAxisEndScreen[0]) + 0.5, Math.round(xAxisEndScreen[1]) + 0.5)
  ctx.stroke()

  // Y axis endpoints are already calculated above

  ctx.beginPath()
  ctx.moveTo(Math.round(yAxisStartScreen[0]) + 0.5, Math.round(yAxisStartScreen[1]) + 0.5)
  ctx.lineTo(Math.round(yAxisEndScreen[0]) + 0.5, Math.round(yAxisEndScreen[1]) + 0.5)
  ctx.stroke()

  // Draw axis labels
  ctx.fillStyle = '#cbd5e1' // text-secondary
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = 1.0

  // Calculate label spacing based on grid step and zoom
  const minLabelSpacingPx = 40 // Minimum pixels between labels on screen
  const parentZoomLabels = viewport.zoom
  // Combined scale: frame coordinate -> parent coordinate -> screen
  // gridStep is the base vector magnitude, so frame coordinate -> parent is gridStep
  // parent -> screen is parentZoom * frameZoom
  const frameToScreenScaleLabels = gridStep * frameZoom * parentZoomLabels
  const screenGridSpacing = frameToScreenScaleLabels
  let labelSpacingMultiplier = 1
  if (screenGridSpacing < minLabelSpacingPx) {
    labelSpacingMultiplier = Math.ceil(minLabelSpacingPx / screenGridSpacing)
  }
  const labelSpacing = gridStep * labelSpacingMultiplier

  // Draw X axis labels
  const startXLabel = Math.floor(minFrameX / labelSpacing) * labelSpacing
  const endXLabel = Math.ceil(maxFrameX / labelSpacing) * labelSpacing
  for (let x = startXLabel; x <= endXLabel; x += labelSpacing) {
    if (Math.abs(x) < 0.001) continue // Skip label at origin (will be drawn separately)
    
    // For nested frames, transform through parent chain
    const labelScreen = frame.parentFrameId
      ? nestedFrameToScreen([x, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
      : frameToScreen([x, 0], frame, viewport, canvasWidth, canvasHeight)
    
    // Format label (remove unnecessary decimals)
    const labelText = x % 1 === 0 ? x.toString() : x.toFixed(2).replace(/\.?0+$/, '')
    ctx.fillText(labelText, labelScreen[0], labelScreen[1] + 15)
  }

  // Draw Y axis labels
  const startYLabel = Math.floor(minFrameY / labelSpacing) * labelSpacing
  const endYLabel = Math.ceil(maxFrameY / labelSpacing) * labelSpacing
  for (let y = startYLabel; y <= endYLabel; y += labelSpacing) {
    if (Math.abs(y) < 0.001) continue // Skip label at origin
    
    // For nested frames, transform through parent chain
    const labelScreen = frame.parentFrameId
      ? nestedFrameToScreen([0, y], frame, allFrames, viewport, canvasWidth, canvasHeight)
      : frameToScreen([0, y], frame, viewport, canvasWidth, canvasHeight)
    
    // Format label (remove unnecessary decimals)
    const labelText = y % 1 === 0 ? y.toString() : y.toFixed(2).replace(/\.?0+$/, '')
    ctx.textAlign = 'right'
    ctx.fillText(labelText, labelScreen[0] - 8, labelScreen[1])
  }

  // Draw origin label (0, 0) at the fixed origin
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('0', originScreenAxes[0] - 5, originScreenAxes[1] + 5)

  ctx.globalAlpha = 1.0
}

