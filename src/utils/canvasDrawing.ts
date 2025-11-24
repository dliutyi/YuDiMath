import type { ViewportState } from '../types'
import { worldToScreen, screenToWorld } from '../utils/coordinates'

/**
 * Draw the background grid
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
) {
  const gridStep = viewport.gridStep
  
  if (gridStep <= 0) {
    return
  }

  // Get visible world bounds to determine which grid lines to draw
  const topLeft = screenToWorld(0, 0, viewport, canvasWidth, canvasHeight)
  const bottomRight = screenToWorld(canvasWidth, canvasHeight, viewport, canvasWidth, canvasHeight)
  
  const minX = Math.min(topLeft[0], bottomRight[0])
  const maxX = Math.max(topLeft[0], bottomRight[0])
  const minY = Math.min(topLeft[1], bottomRight[1])
  const maxY = Math.max(topLeft[1], bottomRight[1])
  
  // Calculate screen spacing to check if grid is too dense
  const screenGridSpacing = gridStep * viewport.zoom
  
  // Only draw grid if spacing is reasonable (not too dense)
  if (screenGridSpacing < 2) {
    return
  }

  // Set grid line style
  ctx.strokeStyle = '#475569' // slate-600
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.25

  // Draw vertical grid lines
  const startX = Math.floor(minX / gridStep) * gridStep
  const endX = Math.ceil(maxX / gridStep) * gridStep
  
  for (let worldX = startX; worldX <= endX; worldX += gridStep) {
    const screenPos = worldToScreen(worldX, 0, viewport, canvasWidth, canvasHeight)
    const screenX = Math.round(screenPos[0]) + 0.5
    
    if (screenX >= -10 && screenX <= canvasWidth + 10) {
      ctx.beginPath()
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, canvasHeight)
      ctx.stroke()
    }
  }

  // Draw horizontal grid lines
  const startY = Math.floor(minY / gridStep) * gridStep
  const endY = Math.ceil(maxY / gridStep) * gridStep
  
  for (let worldY = startY; worldY <= endY; worldY += gridStep) {
    const screenPos = worldToScreen(0, worldY, viewport, canvasWidth, canvasHeight)
    const screenY = Math.round(screenPos[1]) + 0.5
    
    if (screenY >= -10 && screenY <= canvasHeight + 10) {
      ctx.beginPath()
      ctx.moveTo(0, screenY)
      ctx.lineTo(canvasWidth, screenY)
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 1.0
}

/**
 * Draw the X and Y axes
 */
export function drawAxes(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.strokeStyle = '#64748b' // axis color
  ctx.lineWidth = 2
  ctx.globalAlpha = 1.0
  
  // Draw X axis (horizontal line at y=0)
  const xAxisScreen = worldToScreen(0, 0, viewport, canvasWidth, canvasHeight)
  const xAxisY = Math.round(xAxisScreen[1]) + 0.5
  
  if (xAxisY >= -10 && xAxisY <= canvasHeight + 10) {
    ctx.beginPath()
    ctx.moveTo(0, xAxisY)
    ctx.lineTo(canvasWidth, xAxisY)
    ctx.stroke()
  }

  // Draw Y axis (vertical line at x=0)
  const yAxisScreen = worldToScreen(0, 0, viewport, canvasWidth, canvasHeight)
  const yAxisX = Math.round(yAxisScreen[0]) + 0.5
  
  if (yAxisX >= -10 && yAxisX <= canvasWidth + 10) {
    ctx.beginPath()
    ctx.moveTo(yAxisX, 0)
    ctx.lineTo(yAxisX, canvasHeight)
    ctx.stroke()
  }

  // Draw axis labels
  ctx.fillStyle = '#cbd5e1' // text-secondary
  ctx.font = 'bold 12px sans-serif'
  
  const minLabelSpacingPx = 50
  const screenGridSpacing = viewport.gridStep * viewport.zoom
  
  let labelSpacingMultiplier = 1
  if (screenGridSpacing < minLabelSpacingPx) {
    labelSpacingMultiplier = Math.ceil(minLabelSpacingPx / screenGridSpacing)
  }
  
  const labelSpacing = viewport.gridStep * labelSpacingMultiplier
  
  drawAxisLabelsX(ctx, viewport, canvasWidth, canvasHeight, xAxisY, labelSpacing)
  drawAxisLabelsY(ctx, viewport, canvasWidth, canvasHeight, yAxisX, labelSpacing)
}

/**
 * Draw labels along the X-axis
 */
function drawAxisLabelsX(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  axisY: number,
  labelSpacing: number
) {
  const leftWorld = screenToWorld(0, 0, viewport, canvasWidth, canvasHeight)[0]
  const rightWorld = screenToWorld(canvasWidth, 0, viewport, canvasWidth, canvasHeight)[0]
  
  const minX = Math.min(leftWorld, rightWorld)
  const maxX = Math.max(leftWorld, rightWorld)
  
  const startX = Math.floor(minX / labelSpacing) * labelSpacing
  
  for (let x = startX; x <= maxX; x += labelSpacing) {
    if (Math.abs(x) < 0.001) continue
    
    const screenPos = worldToScreen(x, 0, viewport, canvasWidth, canvasHeight)
    const screenX = Math.round(screenPos[0])
    
    if (screenX >= 0 && screenX <= canvasWidth) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const label = formatNumber(x)
      ctx.fillText(label, screenX, axisY + 5)
    }
  }
  
  // Draw origin label
  const origin = worldToScreen(0, 0, viewport, canvasWidth, canvasHeight)
  if (origin[0] >= 0 && origin[0] <= canvasWidth) {
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText('0', origin[0] - 5, origin[1] + 5)
  }
}

/**
 * Draw labels along the Y-axis
 */
function drawAxisLabelsY(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  axisX: number,
  labelSpacing: number
) {
  const topWorld = screenToWorld(0, 0, viewport, canvasWidth, canvasHeight)[1]
  const bottomWorld = screenToWorld(0, canvasHeight, viewport, canvasWidth, canvasHeight)[1]
  
  const minY = Math.min(topWorld, bottomWorld)
  const maxY = Math.max(topWorld, bottomWorld)
  
  const startY = Math.floor(minY / labelSpacing) * labelSpacing
  
  for (let y = startY; y <= maxY; y += labelSpacing) {
    if (Math.abs(y) < 0.001) continue
    
    const screenPos = worldToScreen(0, y, viewport, canvasWidth, canvasHeight)
    const screenY = Math.round(screenPos[1])
    
    if (screenY >= 0 && screenY <= canvasHeight) {
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      const label = formatNumber(y)
      ctx.fillText(label, axisX - 5, screenY)
    }
  }
}

/**
 * Format a number for display (remove unnecessary decimals)
 */
function formatNumber(value: number): string {
  if (Math.abs(value - Math.round(value)) < 0.0001) {
    return Math.round(value).toString()
  }
  
  const rounded = Math.round(value * 1000) / 1000
  return rounded.toString()
}

