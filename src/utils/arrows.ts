import type { Point2D } from '../types'

/**
 * Draw an arrow on the canvas
 * @param ctx Canvas rendering context
 * @param start Start point [x, y] in screen coordinates
 * @param end End point [x, y] in screen coordinates
 * @param color Arrow color (default: '#3b82f6')
 * @param lineWidth Line width (default: 2)
 * @param arrowSize Arrowhead size in pixels (default: 8)
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  start: Point2D,
  end: Point2D,
  color: string = '#3b82f6',
  lineWidth: number = 2,
  arrowSize: number = 8
) {
  const [startX, startY] = start
  const [endX, endY] = end

  // Calculate arrow direction
  const dx = endX - startX
  const dy = endY - startY
  const length = Math.sqrt(dx * dx + dy * dy)

  // Skip if vector is too short
  if (length < 0.1) {
    return
  }

  // Normalize direction
  const unitX = dx / length
  const unitY = dy / length

  // Calculate arrowhead points
  // Arrowhead is a triangle pointing in the direction of the vector
  const arrowAngle = Math.PI / 6 // 30 degrees
  const arrowLength = arrowSize

  // Perpendicular vector for arrowhead base
  const perpX = -unitY
  const perpY = unitX

  // Arrowhead points
  const arrowBaseX = endX - arrowLength * unitX
  const arrowBaseY = endY - arrowLength * unitY

  const arrowLeftX = arrowBaseX + arrowLength * Math.sin(arrowAngle) * perpX
  const arrowLeftY = arrowBaseY + arrowLength * Math.sin(arrowAngle) * perpY

  const arrowRightX = arrowBaseX - arrowLength * Math.sin(arrowAngle) * perpX
  const arrowRightY = arrowBaseY - arrowLength * Math.sin(arrowAngle) * perpY

  // Draw arrow line
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(Math.round(startX) + 0.5, Math.round(startY) + 0.5)
  ctx.lineTo(Math.round(arrowBaseX) + 0.5, Math.round(arrowBaseY) + 0.5)
  ctx.stroke()

  // Draw arrowhead (filled triangle)
  ctx.beginPath()
  ctx.moveTo(Math.round(endX) + 0.5, Math.round(endY) + 0.5)
  ctx.lineTo(Math.round(arrowLeftX) + 0.5, Math.round(arrowLeftY) + 0.5)
  ctx.lineTo(Math.round(arrowRightX) + 0.5, Math.round(arrowRightY) + 0.5)
  ctx.closePath()
  ctx.fill()
}

