import { useEffect, useRef } from 'react'
import type { ViewportState } from '../types'
import {
  worldToScreen,
} from '../utils/coordinates'

interface CanvasProps {
  viewport: ViewportState
  onViewportChange?: (viewport: ViewportState) => void
  width?: number
  height?: number
}

export default function Canvas({
  viewport,
  width,
  height,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const draw = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      console.log('[Canvas.draw] Missing canvas or container')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('[Canvas.draw] Failed to get 2d context')
      return
    }

    // Get actual container dimensions
    const rect = container.getBoundingClientRect()
    const canvasWidth = width || rect.width || 800
    const canvasHeight = height || rect.height || 600

    console.log('[Canvas.draw] Canvas dimensions:', { canvasWidth, canvasHeight, rectWidth: rect.width, rectHeight: rect.height })

    // Skip if dimensions are invalid
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      console.log('[Canvas.draw] Invalid dimensions, skipping')
      return
    }

    // Set canvas internal size (for high DPI displays)
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    ctx.scale(dpr, dpr)
    
    console.log('[Canvas.draw] Canvas set to:', { width: canvas.width, height: canvas.height, dpr })

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Draw grid first (so axes appear on top)
    console.log('[Canvas.draw] Drawing grid...')
    drawGrid(ctx, viewport, canvasWidth, canvasHeight)

    // Draw axes on top
    console.log('[Canvas.draw] Drawing axes...')
    drawAxes(ctx, viewport, canvasWidth, canvasHeight)
    console.log('[Canvas.draw] Drawing complete')
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
      style={{ minHeight: '400px' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
) {
  console.log('[drawGrid] Called with:', { canvasWidth, canvasHeight, viewport })
  
  // Set grid line style - make it more visible
  ctx.strokeStyle = '#475569' // slate-600 - more visible than rgba
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.4

  const gridStep = viewport.gridStep
  console.log('[drawGrid] gridStep:', gridStep)
  
  if (gridStep <= 0) {
    console.log('[drawGrid] Grid step is <= 0, skipping')
    ctx.globalAlpha = 1.0
    return
  }

  // Calculate how many grid lines we need based on visible area
  // Use screen-space to determine appropriate spacing
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  
  // Calculate world-to-screen scale
  const worldToScreenScale = viewport.zoom
  const screenGridSpacing = gridStep * worldToScreenScale
  
  console.log('[drawGrid] screenGridSpacing:', screenGridSpacing, 'worldToScreenScale:', worldToScreenScale)

  // Only draw grid if spacing is reasonable (not too dense, not too sparse)
  if (screenGridSpacing < 5) {
    console.log('[drawGrid] Grid too dense (spacing < 5px), skipping. Consider increasing gridStep or zoom')
    ctx.globalAlpha = 1.0
    return
  }

  // Draw vertical grid lines
  // Start from center and go outward
  let x = 0
  let verticalLinesDrawn = 0
  while (true) {
    // Draw line at +x
    if (x !== 0) {
      const screenX = centerX + x * worldToScreenScale
      if (screenX > canvasWidth + 10) break
      if (screenX >= -10) {
        ctx.beginPath()
        ctx.moveTo(screenX, 0)
        ctx.lineTo(screenX, canvasHeight)
        ctx.stroke()
        verticalLinesDrawn++
      }
    }
    
    // Draw line at -x
    if (x !== 0) {
      const screenX = centerX - x * worldToScreenScale
      if (screenX < -10) break
      if (screenX <= canvasWidth + 10) {
        ctx.beginPath()
        ctx.moveTo(screenX, 0)
        ctx.lineTo(screenX, canvasHeight)
        ctx.stroke()
        verticalLinesDrawn++
      }
    }
    
    x += gridStep
    if (x * worldToScreenScale > canvasWidth + 100) break
  }
  console.log('[drawGrid] Vertical lines drawn:', verticalLinesDrawn)

  // Draw horizontal grid lines
  let y = 0
  let horizontalLinesDrawn = 0
  while (true) {
    // Draw line at +y
    if (y !== 0) {
      const screenY = centerY - y * worldToScreenScale // Note: Y is inverted
      if (screenY < -10) break
      if (screenY <= canvasHeight + 10) {
        ctx.beginPath()
        ctx.moveTo(0, screenY)
        ctx.lineTo(canvasWidth, screenY)
        ctx.stroke()
        horizontalLinesDrawn++
      }
    }
    
    // Draw line at -y
    if (y !== 0) {
      const screenY = centerY + y * worldToScreenScale // Note: Y is inverted
      if (screenY > canvasHeight + 10) break
      if (screenY >= -10) {
        ctx.beginPath()
        ctx.moveTo(0, screenY)
        ctx.lineTo(canvasWidth, screenY)
        ctx.stroke()
        horizontalLinesDrawn++
      }
    }
    
    y += gridStep
    if (y * worldToScreenScale > canvasHeight + 100) break
  }
  console.log('[drawGrid] Horizontal lines drawn:', horizontalLinesDrawn)
  console.log('[drawGrid] Total grid lines drawn:', verticalLinesDrawn + horizontalLinesDrawn)

  // Restore alpha
  ctx.globalAlpha = 1.0
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

