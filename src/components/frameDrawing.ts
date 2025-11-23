import type { CoordinateFrame, ViewportState, Point2D } from '../types'
import { worldToScreen } from '../utils/coordinates'
import { drawArrow } from '../utils/arrows'
import {
  frameToScreen,
  nestedFrameToScreen,
  parentToFrame,
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
  const iMagnitude = Math.sqrt(baseI[0] ** 2 + baseI[1] ** 2)
  const jMagnitude = Math.sqrt(baseJ[0] ** 2 + baseJ[1] ** 2)
  const avgMagnitude = (iMagnitude + jMagnitude) / 2
  const gridStep = avgMagnitude > 0 ? avgMagnitude : 1.0

  const gridColor = getGridColorForLevel(nestingLevel)
  
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.7
  ctx.setLineDash([])

  const topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
  const bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)
  const frameScreenWidth = bottomRight[0] - topLeft[0]
  const frameScreenHeight = bottomRight[1] - topLeft[1]

  const frameZoom = frameViewport.zoom
  const framePanX = frameViewport.x
  const framePanY = frameViewport.y
  const parentZoom = viewport.zoom
  const frameToScreenScale = gridStep * frameZoom * parentZoom
  
  const halfFrameWidth = (frameScreenWidth / frameToScreenScale) / 2
  const halfFrameHeight = (frameScreenHeight / frameToScreenScale) / 2

  const minU = -halfFrameWidth - framePanX
  const maxU = halfFrameWidth - framePanX
  const minV = -halfFrameHeight - framePanY
  const maxV = halfFrameHeight - framePanY
  
  const padding = Math.max(frameScreenWidth, frameScreenHeight) / frameToScreenScale * 3
  const expandedMinU = minU - padding
  const expandedMaxU = maxU + padding
  const expandedMinV = minV - padding
  const expandedMaxV = maxV + padding

  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)
  
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
  const { bounds, baseI, baseJ, viewport: frameViewport } = frame

  const iMagnitude = Math.sqrt(baseI[0] ** 2 + baseI[1] ** 2)
  const jMagnitude = Math.sqrt(baseJ[0] ** 2 + baseJ[1] ** 2)
  const avgMagnitude = (iMagnitude + jMagnitude) / 2
  const gridStep = avgMagnitude > 0 ? avgMagnitude : 1.0

  const topLeft = worldToScreen(bounds.x, bounds.y + bounds.height, viewport, canvasWidth, canvasHeight)
  const bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y, viewport, canvasWidth, canvasHeight)

  const frameScreenWidth = bottomRight[0] - topLeft[0]
  const frameScreenHeight = bottomRight[1] - topLeft[1]

  const frameZoom = frameViewport.zoom
  const framePanX = frameViewport.x
  const framePanY = frameViewport.y
  const parentZoomAxes = viewport.zoom
  const frameToScreenScaleAxes = gridStep * frameZoom * parentZoomAxes
  const halfFrameWidth = (frameScreenWidth / frameToScreenScaleAxes) / 2
  const halfFrameHeight = (frameScreenHeight / frameToScreenScaleAxes) / 2
  const paddingForLabels = Math.max(frameScreenWidth, frameScreenHeight) / frameToScreenScaleAxes * 3
  const minFrameX = -halfFrameWidth - framePanX - paddingForLabels
  const maxFrameX = halfFrameWidth - framePanX + paddingForLabels
  const minFrameY = -halfFrameHeight - framePanY - paddingForLabels
  const maxFrameY = halfFrameHeight - framePanY + paddingForLabels

  const topLeftScreen = topLeft
  const topRightScreen: Point2D = [bottomRight[0], topLeft[1]]
  const bottomLeftScreen: Point2D = [topLeft[0], bottomRight[1]]
  const bottomRightScreen = bottomRight
  
  const originScreenAxes = frame.parentFrameId
    ? nestedFrameToScreen([0, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, 0], frame, viewport, canvasWidth, canvasHeight)
  
  const iAxisEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([1, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([1, 0], frame, viewport, canvasWidth, canvasHeight)
  const jAxisEndScreen = frame.parentFrameId
    ? nestedFrameToScreen([0, 1], frame, allFrames, viewport, canvasWidth, canvasHeight)
    : frameToScreen([0, 1], frame, viewport, canvasWidth, canvasHeight)
  
  const baseIDirX = iAxisEndScreen[0] - originScreenAxes[0]
  const baseIDirY = iAxisEndScreen[1] - originScreenAxes[1]
  const baseJDirX = jAxisEndScreen[0] - originScreenAxes[0]
  const baseJDirY = jAxisEndScreen[1] - originScreenAxes[1]
  
  let xAxisStartScreen = originScreenAxes
  let xAxisEndScreen = originScreenAxes
  
  if (Math.abs(baseIDirX) > 0.001) {
    const tLeft = (topLeftScreen[0] - originScreenAxes[0]) / baseIDirX
    const yLeft = originScreenAxes[1] + tLeft * baseIDirY
    if (yLeft >= topLeftScreen[1] && yLeft <= bottomLeftScreen[1]) {
      xAxisStartScreen = [topLeftScreen[0], yLeft]
    }
    
    const tRight = (bottomRightScreen[0] - originScreenAxes[0]) / baseIDirX
    const yRight = originScreenAxes[1] + tRight * baseIDirY
    if (yRight >= topRightScreen[1] && yRight <= bottomRightScreen[1]) {
      xAxisEndScreen = [bottomRightScreen[0], yRight]
    }
  }
  
  let yAxisStartScreen = originScreenAxes
  let yAxisEndScreen = originScreenAxes
  
  if (Math.abs(baseJDirY) > 0.001) {
    const tTop = (topLeftScreen[1] - originScreenAxes[1]) / baseJDirY
    const xTop = originScreenAxes[0] + tTop * baseJDirX
    if (xTop >= topLeftScreen[0] && xTop <= topRightScreen[0]) {
      yAxisStartScreen = [xTop, topLeftScreen[1]]
    }
    
    const tBottom = (bottomRightScreen[1] - originScreenAxes[1]) / baseJDirY
    const xBottom = originScreenAxes[0] + tBottom * baseJDirX
    if (xBottom >= bottomLeftScreen[0] && xBottom <= bottomRightScreen[0]) {
      yAxisEndScreen = [xBottom, bottomRightScreen[1]]
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

  const minLabelSpacingPx = 40
  const parentZoomLabels = viewport.zoom
  const frameToScreenScaleLabels = gridStep * frameZoom * parentZoomLabels
  const screenGridSpacing = frameToScreenScaleLabels
  let labelSpacingMultiplier = 1
  if (screenGridSpacing < minLabelSpacingPx) {
    labelSpacingMultiplier = Math.ceil(minLabelSpacingPx / screenGridSpacing)
  }
  const labelSpacing = gridStep * labelSpacingMultiplier

  const startXLabel = Math.floor(minFrameX / labelSpacing) * labelSpacing
  const endXLabel = Math.ceil(maxFrameX / labelSpacing) * labelSpacing
  for (let x = startXLabel; x <= endXLabel; x += labelSpacing) {
    if (Math.abs(x) < 0.001) continue
    
    const labelScreen = frame.parentFrameId
      ? nestedFrameToScreen([x, 0], frame, allFrames, viewport, canvasWidth, canvasHeight)
      : frameToScreen([x, 0], frame, viewport, canvasWidth, canvasHeight)
    
    const labelText = x % 1 === 0 ? x.toString() : x.toFixed(2).replace(/\.?0+$/, '')
    ctx.fillText(labelText, labelScreen[0], labelScreen[1] + 15)
  }

  const startYLabel = Math.floor(minFrameY / labelSpacing) * labelSpacing
  const endYLabel = Math.ceil(maxFrameY / labelSpacing) * labelSpacing
  for (let y = startYLabel; y <= endYLabel; y += labelSpacing) {
    if (Math.abs(y) < 0.001) continue
    
    const labelScreen = frame.parentFrameId
      ? nestedFrameToScreen([0, y], frame, allFrames, viewport, canvasWidth, canvasHeight)
      : frameToScreen([0, y], frame, viewport, canvasWidth, canvasHeight)
    
    const labelText = y % 1 === 0 ? y.toString() : y.toFixed(2).replace(/\.?0+$/, '')
    ctx.textAlign = 'right'
    ctx.fillText(labelText, labelScreen[0] - 8, labelScreen[1])
  }

  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('0', originScreenAxes[0] - 5, originScreenAxes[1] + 5)

  ctx.globalAlpha = 1.0
}

