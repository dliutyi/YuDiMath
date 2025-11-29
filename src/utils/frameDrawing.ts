import type { CoordinateFrame, ViewportState, Point2D } from '../types'
import { worldToScreen } from '../utils/coordinates'
import { drawArrow } from '../utils/arrows'
import {
  frameToScreen,
  nestedFrameToScreen,
  parentToFrame,
} from './frameTransforms'
import { getBackgroundColorForLevel } from './frameUtils'
import { drawFrameGrid } from './gridDrawing'
import { drawFrameAxes } from './axesDrawing'
import { drawFrameVectors } from './vectorDrawing'
import { drawFrameFunctions } from './functionDrawing'

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

  drawArrow(ctx, originScreen, baseIEndScreen, '#f97316', 3.5, 8) // Orange to match X-axis labels, thicker for base vectors
  drawArrow(ctx, originScreen, baseJEndScreen, '#10b981', 3.5, 8) // Green to match Y-axis labels, thicker for base vectors
  
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
