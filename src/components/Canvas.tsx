import { useEffect, useRef, useCallback, useState } from 'react'
import type { ViewportState, CoordinateFrame, Point2D, FrameBounds } from '../types'
import {
  worldToScreen,
  screenToWorld,
  snapPointToGrid,
  isFrameInsideFrame,
  clampPointToFrameBounds,
} from '../utils/coordinates'
import { drawCoordinateFrame } from './CoordinateFrame'

interface CanvasProps {
  viewport: ViewportState
  onViewportChange?: (viewport: ViewportState) => void
  width?: number
  height?: number
  frames?: CoordinateFrame[]
  isDrawing?: boolean
  onDrawingModeChange?: (isDrawing: boolean) => void
  onFrameCreated?: (frame: CoordinateFrame, parentFrameId: string | null) => void
}

export default function Canvas({
  viewport,
  onViewportChange,
  width,
  height,
  frames = [],
  isDrawing = false,
  onDrawingModeChange,
  onFrameCreated,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Pan state
  const isPanningRef = useRef(false)
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null)
  
  // Rectangle drawing state
  const [drawingRect, setDrawingRect] = useState<{
    start: Point2D | null
    end: Point2D | null
    parentFrame: CoordinateFrame | null
  }>({ start: null, end: null, parentFrame: null })
  
  // Zoom constraints
  // Default zoom is 50 (1 unit = 50px), so min/max are relative to that
  const MIN_ZOOM = 5.0   // 1 unit = 5px (zoomed out)
  const MAX_ZOOM = 500.0 // 1 unit = 500px (zoomed in)
  const ZOOM_SENSITIVITY = 0.1 // 10x more sensitive than before (was 0.01)

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
    
    // Enable crisp rendering by aligning to pixel boundaries
    ctx.imageSmoothingEnabled = false
    
    console.log('[Canvas.draw] Canvas set to:', { width: canvas.width, height: canvas.height, dpr })

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Draw grid first (so axes appear on top)
    console.log('[Canvas.draw] Drawing grid...')
    drawGrid(ctx, viewport, canvasWidth, canvasHeight)

    // Draw axes on top
    console.log('[Canvas.draw] Drawing axes...')
    drawAxes(ctx, viewport, canvasWidth, canvasHeight)

    // Draw existing frames (only top-level frames, children are drawn recursively)
    console.log('[Canvas.draw] Drawing frames:', frames.length)
    const topLevelFrames = frames.filter(f => f.parentFrameId === null)
    topLevelFrames.forEach((frame) => {
      drawCoordinateFrame(ctx, frame, viewport, canvasWidth, canvasHeight, frames)
    })

    // Draw rectangle being created
    if (drawingRect.start && drawingRect.end) {
      // If drawing inside a parent frame, draw the parent frame's border as a constraint indicator
      if (drawingRect.parentFrame) {
        const parentBounds = drawingRect.parentFrame.bounds
        const parentTopLeft = worldToScreen(parentBounds.x, parentBounds.y + parentBounds.height, viewport, canvasWidth, canvasHeight)
        const parentBottomRight = worldToScreen(parentBounds.x + parentBounds.width, parentBounds.y, viewport, canvasWidth, canvasHeight)
        const parentScreenWidth = parentBottomRight[0] - parentTopLeft[0]
        const parentScreenHeight = parentBottomRight[1] - parentTopLeft[1]
        
        // Draw parent frame border as a constraint indicator (darker, thicker)
        ctx.strokeStyle = '#3b82f6' // primary color
        ctx.lineWidth = 3
        ctx.setLineDash([10, 5]) // Longer dashes for constraint
        ctx.beginPath()
        ctx.rect(
          Math.round(parentTopLeft[0]) + 0.5,
          Math.round(parentTopLeft[1]) + 0.5,
          parentScreenWidth,
          parentScreenHeight
        )
        ctx.stroke()
        ctx.setLineDash([]) // Reset line dash
      }
      
      const [x1, y1] = drawingRect.start
      const [x2, y2] = drawingRect.end

      // Calculate bounds
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)

      // Convert corners to screen coordinates
      const topLeft = worldToScreen(minX, maxY, viewport, canvasWidth, canvasHeight)
      const bottomRight = worldToScreen(maxX, minY, viewport, canvasWidth, canvasHeight)

      const screenWidth = bottomRight[0] - topLeft[0]
      const screenHeight = bottomRight[1] - topLeft[1]

      // Draw rectangle outline
      ctx.strokeStyle = '#3b82f6' // primary color
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5]) // Dashed line for drawing state
      ctx.beginPath()
      ctx.rect(
        Math.round(topLeft[0]) + 0.5,
        Math.round(topLeft[1]) + 0.5,
        screenWidth,
        screenHeight
      )
      ctx.stroke()
      ctx.setLineDash([]) // Reset line dash
    }

    console.log('[Canvas.draw] Drawing complete')
  }

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    const frameId = requestAnimationFrame(() => {
      draw()
    })
    return () => cancelAnimationFrame(frameId)
  }, [viewport, width, height, drawingRect, frames])

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

  // Attach wheel event listener with passive: false to prevent browser zoom
  // This must be in capture phase to prevent browser zoom before React handles it
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !onViewportChange) return

    const wheelHandler = (e: WheelEvent) => {
      // Prevent browser zoom but allow event to bubble to React handler
      e.preventDefault()
      // Don't stop propagation - let React handle it
    }

    // Use capture phase and non-passive to ensure we can preventDefault
    canvas.addEventListener('wheel', wheelHandler, { passive: false, capture: true })
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler, { capture: true } as EventListenerOptions)
    }
  }, [onViewportChange])

  // Pan and drawing handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only handle left mouse button
    if (e.button !== 0) return
    
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const canvasWidth = width || rect.width || 800
    const canvasHeight = height || rect.height || 600

    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    if (isDrawing) {
      // Start drawing rectangle
      const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
      const snappedPoint = snapPointToGrid(worldPoint, viewport.gridStep)
      
      // Find the innermost parent frame that contains the starting point
      let parentFrame: CoordinateFrame | null = null
      let smallestArea = Infinity
      
      for (const frame of frames) {
        const { bounds } = frame
        const pointX = snappedPoint[0]
        const pointY = snappedPoint[1]
        
        // Check if point is inside frame bounds
        if (
          pointX >= bounds.x &&
          pointX <= bounds.x + bounds.width &&
          pointY >= bounds.y &&
          pointY <= bounds.y + bounds.height
        ) {
          const frameArea = bounds.width * bounds.height
          if (frameArea < smallestArea) {
            smallestArea = frameArea
            parentFrame = frame
          }
        }
      }
      
      console.log('[Canvas] Starting rectangle drawing at:', snappedPoint, 'parent frame:', parentFrame?.id)
      setDrawingRect({ start: snappedPoint, end: snappedPoint, parentFrame })
    } else {
      // Start panning
      isPanningRef.current = true
      lastPanPointRef.current = { x: screenX, y: screenY }
    }
    e.preventDefault()
  }, [isDrawing, viewport, width, height])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const canvasWidth = width || rect.width || 800
    const canvasHeight = height || rect.height || 600

    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    if (isDrawing && drawingRect.start) {
      // Update rectangle drawing
      const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
      let snappedPoint = snapPointToGrid(worldPoint, viewport.gridStep)
      
      // If drawing inside a parent frame, constrain the point to stay within bounds
      if (drawingRect.parentFrame) {
        snappedPoint = clampPointToFrameBounds(snappedPoint, drawingRect.parentFrame.bounds)
      }
      
      setDrawingRect((prev) => ({ ...prev, end: snappedPoint }))
    } else if (isPanningRef.current && lastPanPointRef.current && onViewportChange) {
      // Panning
      const currentPoint = { x: screenX, y: screenY }

      // Convert screen points to world coordinates
      const lastWorld = screenToWorld(
        lastPanPointRef.current.x,
        lastPanPointRef.current.y,
        viewport,
        canvasWidth,
        canvasHeight
      )
      const currentWorld = screenToWorld(
        currentPoint.x,
        currentPoint.y,
        viewport,
        canvasWidth,
        canvasHeight
      )

      // Calculate pan delta in world coordinates
      const deltaX = lastWorld[0] - currentWorld[0]
      const deltaY = lastWorld[1] - currentWorld[1]

      // Update viewport
      onViewportChange({
        ...viewport,
        x: viewport.x + deltaX,
        y: viewport.y + deltaY,
      })

      lastPanPointRef.current = currentPoint
    }
    e.preventDefault()
  }, [isDrawing, drawingRect.start, viewport, onViewportChange, width, height])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    console.log('[Canvas] Mouse up - isDrawing:', isDrawing, 'drawingRect:', drawingRect)

    if (isDrawing && drawingRect.start) {
      // Get current mouse position for end point
      const rect = container.getBoundingClientRect()
      const canvasWidth = width || rect.width || 800
      const canvasHeight = height || rect.height || 600
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
      let endPoint = drawingRect.end || snapPointToGrid(worldPoint, viewport.gridStep)
      
      // If drawing inside a parent frame, constrain the end point to stay within bounds
      if (drawingRect.parentFrame) {
        endPoint = clampPointToFrameBounds(endPoint, drawingRect.parentFrame.bounds)
      }

      console.log('[Canvas] End point:', endPoint, 'start:', drawingRect.start)

      if (onFrameCreated) {
        // Finalize rectangle and create frame
        const [x1, y1] = drawingRect.start
        const [x2, y2] = endPoint
        
        // Calculate bounds (ensure positive width and height)
        let minX = Math.min(x1, x2)
        let maxX = Math.max(x1, x2)
        let minY = Math.min(y1, y2)
        let maxY = Math.max(y1, y2)
        
        // If drawing inside a parent frame, constrain bounds to stay within parent
        if (drawingRect.parentFrame) {
          const parentBounds = drawingRect.parentFrame.bounds
          minX = Math.max(parentBounds.x, minX)
          maxX = Math.min(parentBounds.x + parentBounds.width, maxX)
          minY = Math.max(parentBounds.y, minY)
          maxY = Math.min(parentBounds.y + parentBounds.height, maxY)
        }
        
        const frameWidth = maxX - minX
        const frameHeight = maxY - minY
        
        // Only create frame if it has minimum size
        if (frameWidth > 0.1 && frameHeight > 0.1) {
          const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const newBounds: FrameBounds = {
            x: minX,
            y: minY,
            width: frameWidth,
            height: frameHeight,
          }

          // Find the innermost parent frame that contains this new frame
          // We want the most nested parent (the one closest to the new frame)
          // Strategy: Find all frames that contain the new frame, then pick the one with smallest area
          // (since nested frames are smaller than their parents)
          let parentFrameId: string | null = null
          let smallestArea = Infinity

          // Check all existing frames to find the innermost parent
          for (const frame of frames) {
            if (isFrameInsideFrame(newBounds, frame.bounds)) {
              const frameArea = frame.bounds.width * frame.bounds.height
              // Pick the frame with the smallest area (most nested)
              if (frameArea < smallestArea) {
                smallestArea = frameArea
                parentFrameId = frame.id
              }
            }
          }

          console.log('[Canvas] Found parent frame:', parentFrameId, 'from', frames.length, 'frames')

          // Set origin to the center of the frame viewport
          const originX = minX + frameWidth / 2
          const originY = minY + frameHeight / 2

          // Inherit base vectors from parent frame, or use defaults for top-level frames
          // Default base vectors correspond to unit steps horizontally and vertically
          let baseI: Point2D = [1, 0]
          let baseJ: Point2D = [0, 1]
          
          if (parentFrameId) {
            const parentFrame = frames.find(f => f.id === parentFrameId)
            if (parentFrame) {
              // Inherit base vectors from parent
              baseI = [...parentFrame.baseI]
              baseJ = [...parentFrame.baseJ]
              console.log('[Canvas] Inheriting base vectors from parent:', { baseI, baseJ })
            }
          }

          const newFrame: CoordinateFrame = {
            id: frameId,
            origin: [originX, originY],
            baseI,
            baseJ,
            bounds: newBounds,
            mode: '2d',
            vectors: [],
            functions: [],
            code: '',
            parentFrameId,
            childFrameIds: [],
          }
          console.log('[Canvas] Creating frame:', newFrame)
          console.log('[Canvas] Parent frame ID:', parentFrameId)
          onFrameCreated(newFrame, parentFrameId)
        } else {
          console.log('[Canvas] Frame too small, not creating:', { frameWidth, frameHeight })
        }
      }
      
      // Reset drawing state
      setDrawingRect({ start: null, end: null, parentFrame: null })
      if (onDrawingModeChange) {
        onDrawingModeChange(false)
      }
    }
    
    isPanningRef.current = false
    lastPanPointRef.current = null
  }, [isDrawing, drawingRect, onFrameCreated, onDrawingModeChange, viewport, width, height])

  const handleMouseLeave = useCallback(() => {
    isPanningRef.current = false
    lastPanPointRef.current = null
  }, [])

  // Zoom handler - prevent browser zoom interference
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!onViewportChange) return

    // Prevent browser zoom - must be called early
    e.preventDefault()
    e.stopPropagation()

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const canvasWidth = width || rect.width || 800
    const canvasHeight = height || rect.height || 600

    // Get mouse position relative to canvas
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Get world coordinates of mouse position before zoom
    const worldBefore = screenToWorld(mouseX, mouseY, viewport, canvasWidth, canvasHeight)

    // Calculate new zoom level
    const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom + zoomDelta))

    // If zoom didn't change (hit constraint), don't update
    if (newZoom === viewport.zoom) return

    // Update viewport with new zoom
    const newViewport: ViewportState = {
      ...viewport,
      zoom: newZoom,
    }

    // Get world coordinates of mouse position after zoom
    const worldAfter = screenToWorld(mouseX, mouseY, newViewport, canvasWidth, canvasHeight)

    // Adjust viewport position to keep the point under the mouse fixed
    onViewportChange({
      ...newViewport,
      x: viewport.x + (worldBefore[0] - worldAfter[0]),
      y: viewport.y + (worldBefore[1] - worldAfter[1]),
    })
  }, [viewport, onViewportChange, width, height, MIN_ZOOM, MAX_ZOOM, ZOOM_SENSITIVITY])

  // Touch handlers for mobile support
  const touchStartRef = useRef<{ x: number; y: number; distance: number } | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      // Single touch - start panning
      const touch = e.touches[0]
      const rect = e.currentTarget.getBoundingClientRect()
      isPanningRef.current = true
      lastPanPointRef.current = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    } else if (e.touches.length === 2) {
      // Two touches - prepare for pinch zoom
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      const rect = e.currentTarget.getBoundingClientRect()
      const centerX = ((touch1.clientX + touch2.clientX) / 2) - rect.left
      const centerY = ((touch1.clientY + touch2.clientY) / 2) - rect.top
      touchStartRef.current = { x: centerX, y: centerY, distance }
      isPanningRef.current = false
    }
    e.preventDefault()
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!onViewportChange) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const canvasWidth = width || rect.width || 800
    const canvasHeight = height || rect.height || 600

    if (e.touches.length === 1 && isPanningRef.current && lastPanPointRef.current) {
      // Single touch - panning
      const touch = e.touches[0]
      const currentPoint = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }

      const lastWorld = screenToWorld(
        lastPanPointRef.current.x,
        lastPanPointRef.current.y,
        viewport,
        canvasWidth,
        canvasHeight
      )
      const currentWorld = screenToWorld(
        currentPoint.x,
        currentPoint.y,
        viewport,
        canvasWidth,
        canvasHeight
      )

      const deltaX = lastWorld[0] - currentWorld[0]
      const deltaY = lastWorld[1] - currentWorld[1]

      onViewportChange({
        ...viewport,
        x: viewport.x + deltaX,
        y: viewport.y + deltaY,
      })

      lastPanPointRef.current = currentPoint
    } else if (e.touches.length === 2 && touchStartRef.current) {
      // Two touches - pinch zoom
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      const scale = distance / touchStartRef.current.distance

      const centerX = ((touch1.clientX + touch2.clientX) / 2) - rect.left
      const centerY = ((touch1.clientY + touch2.clientY) / 2) - rect.top

      // Get world coordinates before zoom
      const worldBefore = screenToWorld(centerX, centerY, viewport, canvasWidth, canvasHeight)

      // Calculate new zoom
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * scale))

      if (newZoom !== viewport.zoom) {
        const newViewport: ViewportState = {
          ...viewport,
          zoom: newZoom,
        }

        const worldAfter = screenToWorld(centerX, centerY, newViewport, canvasWidth, canvasHeight)

        onViewportChange({
          ...newViewport,
          x: viewport.x + (worldBefore[0] - worldAfter[0]),
          y: viewport.y + (worldBefore[1] - worldAfter[1]),
        })
      }

      touchStartRef.current.distance = distance
    }

    e.preventDefault()
  }, [viewport, onViewportChange, width, height, MIN_ZOOM, MAX_ZOOM])

  const handleTouchEnd = useCallback(() => {
    isPanningRef.current = false
    lastPanPointRef.current = null
    touchStartRef.current = null
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-bg-primary relative overflow-hidden"
      style={{ minHeight: '400px' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }} // Prevent browser zoom on touch
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
  ctx.globalAlpha = 0.4

  // Draw vertical grid lines (lines at x = n * gridStep in world coordinates)
  // Find the first grid line to the left of the visible area
  const startX = Math.floor(minX / gridStep) * gridStep
  const endX = Math.ceil(maxX / gridStep) * gridStep
  
  for (let worldX = startX; worldX <= endX; worldX += gridStep) {
    // Convert world coordinate to screen coordinate
    const screenPos = worldToScreen(worldX, 0, viewport, canvasWidth, canvasHeight)
    const screenX = Math.round(screenPos[0]) + 0.5 // Align to pixel boundary
    
    // Only draw if on screen
    if (screenX >= -10 && screenX <= canvasWidth + 10) {
      ctx.beginPath()
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, canvasHeight)
      ctx.stroke()
    }
  }

  // Draw horizontal grid lines (lines at y = n * gridStep in world coordinates)
  // Find the first grid line below the visible area
  const startY = Math.floor(minY / gridStep) * gridStep
  const endY = Math.ceil(maxY / gridStep) * gridStep
  
  for (let worldY = startY; worldY <= endY; worldY += gridStep) {
    // Convert world coordinate to screen coordinate
    const screenPos = worldToScreen(0, worldY, viewport, canvasWidth, canvasHeight)
    const screenY = Math.round(screenPos[1]) + 0.5 // Align to pixel boundary
    
    // Only draw if on screen
    if (screenY >= -10 && screenY <= canvasHeight + 10) {
      ctx.beginPath()
      ctx.moveTo(0, screenY)
      ctx.lineTo(canvasWidth, screenY)
      ctx.stroke()
    }
  }

  // Restore alpha
  ctx.globalAlpha = 1.0
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
) {
  // Axes are the 0th grid lines (x=0 and y=0)
  // Draw them with a different style to distinguish from regular grid lines
  
  ctx.strokeStyle = '#64748b' // axis color - more prominent than grid
  ctx.lineWidth = 2
  ctx.globalAlpha = 1.0
  
  // Draw X axis (horizontal line at y=0 in world coordinates)
  const xAxisScreen = worldToScreen(0, 0, viewport, canvasWidth, canvasHeight)
  const xAxisY = Math.round(xAxisScreen[1]) + 0.5 // Align to pixel boundary
  
  // Only draw if axis is visible on screen
  if (xAxisY >= -10 && xAxisY <= canvasHeight + 10) {
    ctx.beginPath()
    ctx.moveTo(0, xAxisY)
    ctx.lineTo(canvasWidth, xAxisY)
    ctx.stroke()
  }

  // Draw Y axis (vertical line at x=0 in world coordinates)
  const yAxisScreen = worldToScreen(0, 0, viewport, canvasWidth, canvasHeight)
  const yAxisX = Math.round(yAxisScreen[0]) + 0.5 // Align to pixel boundary
  
  // Only draw if axis is visible on screen
  if (yAxisX >= -10 && yAxisX <= canvasWidth + 10) {
    ctx.beginPath()
    ctx.moveTo(yAxisX, 0)
    ctx.lineTo(yAxisX, canvasHeight)
    ctx.stroke()
  }

  // Draw axis labels at grid line intersections
  ctx.fillStyle = '#cbd5e1' // text-secondary
  ctx.font = '12px sans-serif'
  
  // Calculate label spacing based on gridStep
  // Labels should appear at gridStep intervals, but only when there's enough screen space
  const minLabelSpacingPx = 50 // Minimum pixels between labels on screen
  const screenGridSpacing = viewport.gridStep * viewport.zoom
  
  // Calculate how many gridStep units we need to skip to achieve minLabelSpacingPx
  let labelSpacingMultiplier = 1
  if (screenGridSpacing < minLabelSpacingPx) {
    // Need to skip some grid lines to maintain minimum spacing
    labelSpacingMultiplier = Math.ceil(minLabelSpacingPx / screenGridSpacing)
  }
  
  // Label spacing in world coordinates (must be a multiple of gridStep)
  const labelSpacing = viewport.gridStep * labelSpacingMultiplier
  
  // Draw X-axis labels (horizontal axis) - labels at grid line intersections
  drawAxisLabelsX(ctx, viewport, canvasWidth, canvasHeight, xAxisY, labelSpacing)
  
  // Draw Y-axis labels (vertical axis) - labels at grid line intersections
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
  // Find the range of x values visible on screen
  const leftWorld = screenToWorld(0, 0, viewport, canvasWidth, canvasHeight)[0]
  const rightWorld = screenToWorld(canvasWidth, 0, viewport, canvasWidth, canvasHeight)[0]
  
  const minX = Math.min(leftWorld, rightWorld)
  const maxX = Math.max(leftWorld, rightWorld)
  
  // Start from the first label position (snapped to labelSpacing)
  const startX = Math.floor(minX / labelSpacing) * labelSpacing
  
  // Draw labels
  for (let x = startX; x <= maxX; x += labelSpacing) {
    // Skip origin (will be drawn separately)
    if (Math.abs(x) < 0.001) continue
    
    const screenPos = worldToScreen(x, 0, viewport, canvasWidth, canvasHeight)
    const screenX = Math.round(screenPos[0])
    
    // Only draw if on screen
    if (screenX >= 0 && screenX <= canvasWidth) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      
      // Format number nicely
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
  // Find the range of y values visible on screen
  const topWorld = screenToWorld(0, 0, viewport, canvasWidth, canvasHeight)[1]
  const bottomWorld = screenToWorld(0, canvasHeight, viewport, canvasWidth, canvasHeight)[1]
  
  const minY = Math.min(topWorld, bottomWorld)
  const maxY = Math.max(topWorld, bottomWorld)
  
  // Start from the first label position (snapped to labelSpacing)
  const startY = Math.floor(minY / labelSpacing) * labelSpacing
  
  // Draw labels
  for (let y = startY; y <= maxY; y += labelSpacing) {
    // Skip origin (will be drawn separately)
    if (Math.abs(y) < 0.001) continue
    
    const screenPos = worldToScreen(0, y, viewport, canvasWidth, canvasHeight)
    const screenY = Math.round(screenPos[1])
    
    // Only draw if on screen
    if (screenY >= 0 && screenY <= canvasHeight) {
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      
      // Format number nicely
      const label = formatNumber(y)
      ctx.fillText(label, axisX - 5, screenY)
    }
  }
  
  // Origin label is already drawn in X-axis labels
}

/**
 * Format a number for display (remove unnecessary decimals)
 */
function formatNumber(value: number): string {
  // If very close to an integer, show as integer
  if (Math.abs(value - Math.round(value)) < 0.0001) {
    return Math.round(value).toString()
  }
  
  // Otherwise, show with appropriate decimal places
  // Limit to 3 decimal places
  const rounded = Math.round(value * 1000) / 1000
  return rounded.toString()
}

/**
 * Draw an existing frame on the canvas
 */

