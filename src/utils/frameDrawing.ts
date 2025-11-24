import type { CoordinateFrame, ViewportState, Point2D, Vector, FunctionPlot } from '../types'
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
  // When parent has non-standard base vectors, we need to transform all 4 corners
  // because the coordinate space is distorted (parallelogram, not rectangle)
  let cornersScreen: Point2D[]
  let topLeft: Point2D
  let bottomRight: Point2D
  
  if (frame.parentFrameId) {
    // Nested frame: bounds are stored in parent world coordinates
    // Need to account for parent's viewport (pan/zoom) and base vectors
    const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
    if (parentFrame) {
      // DEBUG: Log parent frame info
      console.log('[drawCoordinateFrame] Nested frame:', frame.id)
      console.log('  Parent frame baseI:', parentFrame.baseI, 'baseJ:', parentFrame.baseJ)
      console.log('  Parent frame viewport:', parentFrame.viewport)
      console.log('  Bounds (parent world):', bounds)
      
      // If frameCoords are stored, use them directly (this is the rectangle in frame space)
      // Otherwise, fall back to converting world bounds (for backwards compatibility)
      let cornersFrame: Point2D[]
      
      if (bounds.frameCoords) {
        // Use stored frame coordinates directly - this is the actual rectangle
        const { minU, maxU, minV, maxV } = bounds.frameCoords
        cornersFrame = [
          [minU, maxV], // top-left
          [maxU, maxV], // top-right
          [maxU, minV], // bottom-right
          [minU, minV], // bottom-left
        ]
        console.log('  Using stored frame coordinates:', bounds.frameCoords)
      } else {
        // Fallback: Convert world bounds to frame coordinates (may not form perfect rectangle)
        const topLeftWorld: Point2D = [bounds.x, bounds.y + bounds.height]
        const topRightWorld: Point2D = [bounds.x + bounds.width, bounds.y + bounds.height]
        const bottomRightWorld: Point2D = [bounds.x + bounds.width, bounds.y]
        const bottomLeftWorld: Point2D = [bounds.x, bounds.y]
        
        const topLeftFrame = parentToFrame(topLeftWorld, parentFrame)
        const topRightFrame = parentToFrame(topRightWorld, parentFrame)
        const bottomRightFrame = parentToFrame(bottomRightWorld, parentFrame)
        const bottomLeftFrame = parentToFrame(bottomLeftWorld, parentFrame)
        
        cornersFrame = [topLeftFrame, topRightFrame, bottomRightFrame, bottomLeftFrame]
        console.log('  Frame corners (converted from world, may not be perfect rectangle):')
        console.log('    topLeftFrame:', topLeftFrame)
        console.log('    topRightFrame:', topRightFrame)
        console.log('    bottomRightFrame:', bottomRightFrame)
        console.log('    bottomLeftFrame:', bottomLeftFrame)
      }
      
      // Transform each corner: parent frame -> apply viewport -> screen
      // Use frameToScreen which correctly applies viewport and transforms to screen
      cornersScreen = cornersFrame.map((cornerFrame, idx) => {
        
        const cornerNames = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
        console.log(`  Corner ${idx} (${cornerNames[idx]}):`)
        console.log('    Frame (raw):', cornerFrame)
        
        // Step 2: Use frameToScreen which applies viewport and transforms to screen
        // This correctly handles: frame coords -> apply viewport -> parent world -> screen
        const screen = frameToScreen(cornerFrame, parentFrame, viewport, canvasWidth, canvasHeight)
        
        // Debug: manually trace the transformation
        const [u, v] = cornerFrame
        const frameU = u - parentFrame.viewport.x
        const frameV = v - parentFrame.viewport.y
        const scaledU = frameU * parentFrame.viewport.zoom
        const scaledV = frameV * parentFrame.viewport.zoom
        const [originX, originY] = parentFrame.origin
        const [iX, iY] = parentFrame.baseI
        const [jX, jY] = parentFrame.baseJ
        const parentX = originX + scaledU * iX + scaledV * jX
        const parentY = originY + scaledU * iY + scaledV * jY
        const centerX = canvasWidth / 2
        const centerY = canvasHeight / 2
        const screenX = centerX + (parentX - viewport.x) * viewport.zoom
        const screenY = centerY - (parentY - viewport.y) * viewport.zoom
        console.log('    After pan:', [frameU, frameV])
        console.log('    After zoom:', [scaledU, scaledV])
        console.log('    Parent world:', [parentX, parentY])
        console.log('    Screen (manual):', [screenX, screenY])
        console.log('    Screen (frameToScreen):', screen)
        
        return screen
      })
      
      console.log('  All corners screen:', cornersScreen)
      
      // Calculate bounding box of transformed corners for clipping
      let minScreenX = Infinity
      let maxScreenX = -Infinity
      let minScreenY = Infinity
      let maxScreenY = -Infinity
      
      for (const corner of cornersScreen) {
        minScreenX = Math.min(minScreenX, corner[0])
        maxScreenX = Math.max(maxScreenX, corner[0])
        minScreenY = Math.min(minScreenY, corner[1])
        maxScreenY = Math.max(maxScreenY, corner[1])
      }
      
      topLeft = [minScreenX, minScreenY]
      bottomRight = [maxScreenX, maxScreenY]
    } else {
      // Parent not found, fall back to direct transformation
      topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
      bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)
      cornersScreen = [
        topLeft,
        [bottomRight[0], topLeft[1]],
        bottomRight,
        [topLeft[0], bottomRight[1]],
      ]
    }
  } else {
    // Top-level frame: use direct world-to-screen transformation
    topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
    bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)
    cornersScreen = [
      topLeft,
      [bottomRight[0], topLeft[1]],
      bottomRight,
      [topLeft[0], bottomRight[1]],
    ]
  }
  
  // Calculate origin in screen coordinates
  const originScreen = frame.parentFrameId
    ? nestedFrameToScreen([0, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, 0], frame, viewport, canvasWidth, canvasHeight)

  // Draw frame background with semi-transparent color
  ctx.fillStyle = getBackgroundColorForLevel(nestingLevel)
  ctx.beginPath()
  ctx.moveTo(Math.round(cornersScreen[0][0]) + 0.5, Math.round(cornersScreen[0][1]) + 0.5)
  for (let i = 1; i < cornersScreen.length; i++) {
    ctx.lineTo(Math.round(cornersScreen[i][0]) + 0.5, Math.round(cornersScreen[i][1]) + 0.5)
  }
  ctx.closePath()
  ctx.fill()

  // Draw frame border with different style if selected
  ctx.strokeStyle = isSelected ? '#3b82f6' : '#60a5fa'
  ctx.lineWidth = isSelected ? 3 : 2
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(Math.round(cornersScreen[0][0]) + 0.5, Math.round(cornersScreen[0][1]) + 0.5)
  for (let i = 1; i < cornersScreen.length; i++) {
    ctx.lineTo(Math.round(cornersScreen[i][0]) + 0.5, Math.round(cornersScreen[i][1]) + 0.5)
  }
  ctx.closePath()
  ctx.stroke()

  // Draw frame grid, axes, and base vectors - all clipped to frame bounds
  ctx.save()
  
  // For nested frames, clip to parent bounds first
  if (frame.parentFrameId) {
    const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
    if (parentFrame) {
      // Parent bounds are in its parent's world coordinates (or root world if top-level)
      // Need to account for parent's viewport and base vectors if parent is also nested
      const parentBounds = parentFrame.bounds
      const parentCornersWorld: Point2D[] = [
        [parentBounds.x, parentBounds.y + parentBounds.height],
        [parentBounds.x + parentBounds.width, parentBounds.y + parentBounds.height],
        [parentBounds.x + parentBounds.width, parentBounds.y],
        [parentBounds.x, parentBounds.y],
      ]
      
      let parentCornersScreen: Point2D[]
      if (parentFrame.parentFrameId) {
        // Parent is also nested - need to transform through its parent
        const grandParentFrame = allFrames.find(f => f.id === parentFrame.parentFrameId)
        if (grandParentFrame) {
          parentCornersScreen = parentCornersWorld.map(cornerWorld => {
            // Transform through grandparent frame (accounts for viewport and base vectors)
            const cornerFrame = parentToFrame(cornerWorld, grandParentFrame)
            const cornerFrameWithViewport: Point2D = [
              (cornerFrame[0] - grandParentFrame.viewport.x) * grandParentFrame.viewport.zoom,
              (cornerFrame[1] - grandParentFrame.viewport.y) * grandParentFrame.viewport.zoom
            ]
            const [originX, originY] = grandParentFrame.origin
            const [iX, iY] = grandParentFrame.baseI
            const [jX, jY] = grandParentFrame.baseJ
            const cornerParentWorldWithViewport: Point2D = [
              originX + cornerFrameWithViewport[0] * iX + cornerFrameWithViewport[1] * jX,
              originY + cornerFrameWithViewport[0] * iY + cornerFrameWithViewport[1] * jY
            ]
            return worldToScreen(cornerParentWorldWithViewport[0], cornerParentWorldWithViewport[1], viewport, canvasWidth, canvasHeight)
          })
        } else {
          // Grandparent not found, use direct transformation
          parentCornersScreen = parentCornersWorld.map(cornerWorld =>
            worldToScreen(cornerWorld[0], cornerWorld[1], viewport, canvasWidth, canvasHeight)
          )
        }
      } else {
        // Parent is top-level - transform directly to screen
        parentCornersScreen = parentCornersWorld.map(cornerWorld =>
          worldToScreen(cornerWorld[0], cornerWorld[1], viewport, canvasWidth, canvasHeight)
        )
      }
      
      ctx.beginPath()
      ctx.moveTo(Math.round(parentCornersScreen[0][0]) + 0.5, Math.round(parentCornersScreen[0][1]) + 0.5)
      for (let i = 1; i < parentCornersScreen.length; i++) {
        ctx.lineTo(Math.round(parentCornersScreen[i][0]) + 0.5, Math.round(parentCornersScreen[i][1]) + 0.5)
      }
      ctx.closePath()
      ctx.clip()
    }
  }
  
  // Clip drawing to frame bounds (parallelogram for nested frames with non-standard base vectors)
  ctx.beginPath()
  ctx.moveTo(Math.round(cornersScreen[0][0]) + 0.5, Math.round(cornersScreen[0][1]) + 0.5)
  for (let i = 1; i < cornersScreen.length; i++) {
    ctx.lineTo(Math.round(cornersScreen[i][0]) + 0.5, Math.round(cornersScreen[i][1]) + 0.5)
  }
  ctx.closePath()
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

  drawArrow(ctx, originScreen, baseIEndScreen, '#f97316', 2, 8) // Orange to match X-axis labels
  drawArrow(ctx, originScreen, baseJEndScreen, '#10b981', 2, 8) // Green to match Y-axis labels
  
  // Draw vectors within clipped region
  drawFrameVectors(ctx, frame, viewport, canvasWidth, canvasHeight, allFrames)
  
  // Draw function plots within clipped region
  drawFrameFunctions(ctx, frame, viewport, canvasWidth, canvasHeight, allFrames)
  
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
  ctx.font = '11px sans-serif'
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

/**
 * Draw a smooth curve through points using cubic Bezier curves
 * Uses proper Catmull-Rom to Bezier conversion for maximum smoothness
 */
function drawSmoothCurve(ctx: CanvasRenderingContext2D, points: Point2D[]): void {
  if (points.length === 0) return
  if (points.length === 1) {
    ctx.moveTo(points[0][0], points[0][1])
    return
  }
  if (points.length === 2) {
    ctx.moveTo(points[0][0], points[0][1])
    ctx.lineTo(points[1][0], points[1][1])
    return
  }
  
  // Enable image smoothing for smoother curves
  const oldSmoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = true
  
  // Start at first point
  ctx.moveTo(points[0][0], points[0][1])
  
  // For each segment, calculate control points using Catmull-Rom spline
  // Convert Catmull-Rom to cubic Bezier control points
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1]
    
    // Catmull-Rom to Bezier conversion
    // Control point 1: 1/6 of the way from p1 toward p2, adjusted by (p2 - p0)
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    
    // Control point 2: 1/6 of the way from p2 toward p1, adjusted by (p3 - p1)
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    
    // Use cubic Bezier curve - don't round, let smoothing handle it
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1])
  }
  
  // Restore original smoothing setting
  ctx.imageSmoothingEnabled = oldSmoothing
}

/**
 * Draw function plots defined in a frame
 * Functions are evaluated and drawn as curves in frame coordinates
 */
function drawFrameFunctions(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
) {
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
        // Collect valid points first for better smoothing
        const validPoints: Array<{ point: Point2D; screen: Point2D }> = []
        
        for (let i = 0; i < func.points.length; i++) {
          const [x, y] = func.points[i]
          
          // Skip invalid points (NaN, Infinity, etc.)
          if (!isFinite(x) || !isFinite(y)) {
            continue
          }
          
          const pointScreen = transformToScreen([x, y])
          
          // Check for discontinuities (large jumps)
          if (validPoints.length > 0) {
            const prevScreen = validPoints[validPoints.length - 1].screen
            const dx = Math.abs(pointScreen[0] - prevScreen[0])
            const dy = Math.abs(pointScreen[1] - prevScreen[1])
            // If the jump is very large (more than 100 pixels), break the path
            if (dx > 100 || dy > 100) {
              // Draw current segment and start new one
              if (validPoints.length > 1) {
                drawSmoothCurve(ctx, validPoints.map(p => p.screen))
              }
              ctx.stroke()
              ctx.beginPath()
              validPoints.length = 0
            }
          }
          
          validPoints.push({ point: [x, y], screen: pointScreen })
        }
        
        // Draw the final segment
        if (validPoints.length > 0) {
          if (validPoints.length === 1) {
            ctx.moveTo(Math.round(validPoints[0].screen[0]) + 0.5, Math.round(validPoints[0].screen[1]) + 0.5)
          } else {
            drawSmoothCurve(ctx, validPoints.map(p => p.screen))
          }
        }
      } else if (func.expression) {
        // Otherwise, evaluate the expression at multiple points
        // Calculate optimal number of points based on range if not specified
        const range = func.xMax - func.xMin
        const baseNumPoints = func.numPoints ?? Math.max(200, Math.min(2000, Math.round(range * 100)))
        const xMin = func.xMin
        const xMax = func.xMax
        const expression = func.expression // Type guard: we know expression exists here
        
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
        
        // Draw the curve, handling discontinuities
        let segmentPoints: Point2D[] = []
        for (let i = 0; i < validPoints.length; i++) {
          const current = validPoints[i]
          
          // Check for discontinuities
          if (segmentPoints.length > 0) {
            const prevScreen = transformToScreen(validPoints[i - 1].point)
            const dx = Math.abs(current.screen[0] - prevScreen[0])
            const dy = Math.abs(current.screen[1] - prevScreen[1])
            
            if (dx > 100 || dy > 100) {
              // Large jump - draw current segment and start new one
              if (segmentPoints.length > 1) {
                drawSmoothCurve(ctx, segmentPoints.map(p => transformToScreen(p)))
              }
              ctx.stroke()
              ctx.beginPath()
              segmentPoints = []
            }
          }
          
          segmentPoints.push(current.point)
        }
        
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
 * Simple expression evaluator for basic math expressions
 * Supports: x, numbers, +, -, *, /, **, parentheses, and common functions
 * This is a simplified evaluator - for complex expressions, consider using a proper parser
 */
function evaluateExpression(expression: string, x: number): number {
  // Replace 'x' with the actual value
  let expr = expression.replace(/x/g, `(${x})`)
  
  // Handle common math functions
  expr = expr.replace(/sin\(/g, 'Math.sin(')
  expr = expr.replace(/cos\(/g, 'Math.cos(')
  expr = expr.replace(/tan\(/g, 'Math.tan(')
  expr = expr.replace(/exp\(/g, 'Math.exp(')
  expr = expr.replace(/log\(/g, 'Math.log(')
  expr = expr.replace(/sqrt\(/g, 'Math.sqrt(')
  expr = expr.replace(/abs\(/g, 'Math.abs(')
  expr = expr.replace(/\*\*/g, '**') // Python's ** is same as JS
  
  // Evaluate using Function constructor (safe for our use case)
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('return ' + expr)()
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result
    }
    throw new Error('Invalid result')
  } catch (e) {
    throw new Error(`Failed to evaluate expression: ${expression}`)
  }
}


