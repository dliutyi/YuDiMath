import { useEffect, useRef } from 'react'
import type { ViewportState } from '../types'
import {
  worldToScreen,
  getVisibleBounds,
} from '../utils/coordinates'

interface CanvasProps {
  viewport: ViewportState
  onViewportChange?: (viewport: ViewportState) => void
  width?: number
  height?: number
}

export default function Canvas({
  viewport,
  onViewportChange,
  width,
  height,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const draw = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get actual container dimensions
    const rect = container.getBoundingClientRect()
    const canvasWidth = width || rect.width || 800
    const canvasHeight = height || rect.height || 600

    // Skip if dimensions are invalid
    if (canvasWidth <= 0 || canvasHeight <= 0) return

    // Set canvas internal size (for high DPI displays)
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Get visible bounds
    const bounds = getVisibleBounds(viewport, canvasWidth, canvasHeight)

    // Draw grid
    drawGrid(ctx, bounds, viewport, canvasWidth, canvasHeight)

    // Draw axes
    drawAxes(ctx, viewport, canvasWidth, canvasHeight)
  }

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    const frameId = requestAnimationFrame(() => {
      draw()
    })
    return () => cancelAnimationFrame(frameId)
  }, [viewport, width, height])

  // Also redraw on window resize
  useEffect(() => {
    const handleResize = () => {
      draw()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [viewport, width, height])

  // Handle canvas resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      // Force re-render by updating viewport (triggers drawing effect)
      // This is a workaround to trigger the drawing effect when container resizes
      const canvas = canvasRef.current
      if (canvas) {
        // Trigger a re-render by dispatching a resize event
        window.dispatchEvent(new Event('resize'))
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-bg-primary relative overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)' // grid-line with better visibility
  ctx.lineWidth = 1

  const gridStep = viewport.gridStep
  if (gridStep <= 0) return

  const startX = Math.floor(bounds.minX / gridStep) * gridStep
  const endX = Math.ceil(bounds.maxX / gridStep) * gridStep
  const startY = Math.floor(bounds.minY / gridStep) * gridStep
  const endY = Math.ceil(bounds.maxY / gridStep) * gridStep

  // Draw vertical grid lines
  for (let x = startX; x <= endX; x += gridStep) {
    const start = worldToScreen(x, bounds.minY, viewport, canvasWidth, canvasHeight)
    const end = worldToScreen(x, bounds.maxY, viewport, canvasWidth, canvasHeight)
    
    // Only draw if line is within canvas bounds
    if (start[0] >= 0 && start[0] <= canvasWidth && end[0] >= 0 && end[0] <= canvasWidth) {
      ctx.beginPath()
      ctx.moveTo(start[0], start[1])
      ctx.lineTo(end[0], end[1])
      ctx.stroke()
    }
  }

  // Draw horizontal grid lines
  for (let y = startY; y <= endY; y += gridStep) {
    const start = worldToScreen(bounds.minX, y, viewport, canvasWidth, canvasHeight)
    const end = worldToScreen(bounds.maxX, y, viewport, canvasWidth, canvasHeight)
    
    // Only draw if line is within canvas bounds
    if (start[1] >= 0 && start[1] <= canvasHeight && end[1] >= 0 && end[1] <= canvasHeight) {
      ctx.beginPath()
      ctx.moveTo(start[0], start[1])
      ctx.lineTo(end[0], end[1])
      ctx.stroke()
    }
  }
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.strokeStyle = '#64748b' // axis color
  ctx.lineWidth = 2

  // Draw X axis (horizontal line at y=0)
  const xAxisStart = worldToScreen(
    -10000,
    0,
    viewport,
    canvasWidth,
    canvasHeight
  )
  const xAxisEnd = worldToScreen(
    10000,
    0,
    viewport,
    canvasWidth,
    canvasHeight
  )

  ctx.beginPath()
  ctx.moveTo(xAxisStart[0], xAxisStart[1])
  ctx.lineTo(xAxisEnd[0], xAxisEnd[1])
  ctx.stroke()

  // Draw Y axis (vertical line at x=0)
  const yAxisStart = worldToScreen(
    0,
    -10000,
    viewport,
    canvasWidth,
    canvasHeight
  )
  const yAxisEnd = worldToScreen(
    0,
    10000,
    viewport,
    canvasWidth,
    canvasHeight
  )

  ctx.beginPath()
  ctx.moveTo(yAxisStart[0], yAxisStart[1])
  ctx.lineTo(yAxisEnd[0], yAxisEnd[1])
  ctx.stroke()

  // Draw axis labels at origin
  const origin = worldToScreen(0, 0, viewport, canvasWidth, canvasHeight)
  ctx.fillStyle = '#cbd5e1' // text-secondary
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('0', origin[0] - 5, origin[1] + 5)
}

