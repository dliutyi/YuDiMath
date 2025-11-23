import { useEffect, useRef, useCallback } from 'react'
import type { ViewportState, CoordinateFrame, Point2D } from '../types'
import { worldToScreen, screenToWorld } from '../utils/coordinates'
import { drawCoordinateFrame, parentToFrame, nestedFrameToScreen } from './CoordinateFrame'
import { drawGrid, drawAxes } from '../utils/canvasDrawing'
import { useCanvasZoom } from '../hooks/useCanvasZoom'
import { useCanvasDrawing } from '../hooks/useCanvasDrawing'

const MIN_ZOOM = 5.0
const MAX_ZOOM = 500.0

interface CanvasProps {
  viewport: ViewportState
  onViewportChange?: (viewport: ViewportState) => void
  width?: number
  height?: number
  frames?: CoordinateFrame[]
  isDrawing?: boolean
  onDrawingModeChange?: (isDrawing: boolean) => void
  onFrameCreated?: (frame: CoordinateFrame, parentFrameId: string | null) => void
  selectedFrameId?: string | null
  onFrameSelected?: (frameId: string | null) => void
  onFrameViewportChange?: (frameId: string, viewport: ViewportState) => void
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
  selectedFrameId = null,
  onFrameSelected,
  onFrameViewportChange,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Pan state
  const isPanningRef = useRef(false)
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null)
  const panningFrameRef = useRef<string | null>(null)

  // Use hooks for zoom and drawing
  useCanvasZoom({
    canvasRef,
    containerRef,
    viewport,
    frames,
    selectedFrameId,
    width,
    height,
    onViewportChange,
    onFrameViewportChange,
  })

  const { drawingRect, handleMouseDown: handleDrawingMouseDown, handleMouseMove: handleDrawingMouseMove, handleMouseUp: handleDrawingMouseUp } = useCanvasDrawing({
    isDrawing,
    viewport,
    frames,
    width,
    height,
    onFrameCreated,
  })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    // Get actual container dimensions
    const rect = container.getBoundingClientRect()
    const canvasWidth = width || rect.width || 800
    const canvasHeight = height || rect.height || 600


    // Skip if dimensions are invalid
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      return
    }

    // Set canvas internal size (for high DPI displays)
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    ctx.scale(dpr, dpr)
    
    // Enable crisp rendering by aligning to pixel boundaries
    ctx.imageSmoothingEnabled = false
    

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Draw grid first (so axes appear on top)
    drawGrid(ctx, viewport, canvasWidth, canvasHeight)

    // Draw axes on top
    drawAxes(ctx, viewport, canvasWidth, canvasHeight)

    // Draw existing frames (only top-level frames, children are drawn recursively)
    const topLevelFrames = frames.filter(f => f.parentFrameId === null)
    topLevelFrames.forEach((frame) => {
      drawCoordinateFrame(ctx, frame, viewport, canvasWidth, canvasHeight, frames, selectedFrameId, 0)
    })

    // Draw rectangle being created
    if (drawingRect.start && drawingRect.end) {
      const [x1, y1] = drawingRect.start
      const [x2, y2] = drawingRect.end

      // Calculate bounds
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)

      // Convert corners to screen coordinates
      let topLeft: Point2D
      let bottomRight: Point2D
      
      // Look up parent frame from current frames array to get latest base vectors
      const parentFrame = drawingRect.parentFrame 
        ? frames.find(f => f.id === drawingRect.parentFrame!.id) || drawingRect.parentFrame
        : null
      
      if (parentFrame) {
        // For nested frames with non-standard base vectors, we need to transform all 4 corners
        // because the coordinate space is distorted (parallelogram, not rectangle)
        const cornersWorld: Point2D[] = [
          [minX, maxY], // top-left
          [maxX, maxY], // top-right
          [maxX, minY], // bottom-right
          [minX, minY], // bottom-left
        ]
        
        // Transform each corner through parent frame coordinate system
        const cornersScreen: Point2D[] = cornersWorld.map(cornerWorld => {
          // Convert parent world coordinates to parent frame coordinates (raw)
          const cornerFrame = parentToFrame(cornerWorld, parentFrame)
          
          // Apply parent frame's viewport transformation
          const cornerFrameWithViewport: Point2D = [
            (cornerFrame[0] - parentFrame.viewport.x) * parentFrame.viewport.zoom,
            (cornerFrame[1] - parentFrame.viewport.y) * parentFrame.viewport.zoom
          ]
          
          // Transform back to parent world coordinates using base vectors
          const [originX, originY] = parentFrame.origin
          const [iX, iY] = parentFrame.baseI
          const [jX, jY] = parentFrame.baseJ
          
          const cornerParentWorldWithViewport: Point2D = [
            originX + cornerFrameWithViewport[0] * iX + cornerFrameWithViewport[1] * jX,
            originY + cornerFrameWithViewport[0] * iY + cornerFrameWithViewport[1] * jY
          ]
          
          // Transform to screen using root viewport
          return worldToScreen(cornerParentWorldWithViewport[0], cornerParentWorldWithViewport[1], viewport, canvasWidth, canvasHeight)
        })
        
        // Draw parallelogram outline using all 4 corners
        ctx.strokeStyle = '#3b82f6' // primary color
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5]) // Dashed line for drawing state
        ctx.beginPath()
        ctx.moveTo(Math.round(cornersScreen[0][0]) + 0.5, Math.round(cornersScreen[0][1]) + 0.5)
        for (let i = 1; i < cornersScreen.length; i++) {
          ctx.lineTo(Math.round(cornersScreen[i][0]) + 0.5, Math.round(cornersScreen[i][1]) + 0.5)
        }
        ctx.closePath()
        ctx.stroke()
        ctx.setLineDash([]) // Reset line dash
      } else {
        topLeft = worldToScreen(minX, maxY, viewport, canvasWidth, canvasHeight)
        bottomRight = worldToScreen(maxX, minY, viewport, canvasWidth, canvasHeight)
        
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
    }

  }, [viewport, width, height, frames, selectedFrameId, drawingRect])

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    const frameId = requestAnimationFrame(() => {
      draw()
    })
    return () => cancelAnimationFrame(frameId)
  }, [draw])

  // Also redraw on window resize
  useEffect(() => {
    const handleResize = () => {
      draw()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

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


  // Pan and drawing handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
      handleDrawingMouseDown(screenX, screenY, canvasWidth, canvasHeight)
      return
    }

    {
      // Check if clicking on a frame (for selection)
      // We need to check in screen space, accounting for each frame's viewport
      let clickedFrame: CoordinateFrame | null = null
      let smallestArea = Infinity
      
      // Check each frame by converting its bounds to screen coordinates
      // and checking if the click point is inside
      for (const frame of frames) {
        // Get frame bounds in screen coordinates (accounting for viewport)
        let frameTopLeft: Point2D
        let frameBottomRight: Point2D
        
        if (frame.parentFrameId) {
          // Nested frame - transform through parent chain
          const parentFrameForCheck = frames.find(f => f.id === frame.parentFrameId)
          if (parentFrameForCheck) {
            const bounds = frame.bounds
            const topLeftWorld: Point2D = [bounds.x, bounds.y + bounds.height]
            const bottomRightWorld: Point2D = [bounds.x + bounds.width, bounds.y]
            const topLeftFrame = parentToFrame(topLeftWorld, parentFrameForCheck)
            const bottomRightFrame = parentToFrame(bottomRightWorld, parentFrameForCheck)
            frameTopLeft = nestedFrameToScreen(topLeftFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight)
            frameBottomRight = nestedFrameToScreen(bottomRightFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight)
          } else {
            continue
          }
        } else {
          // Top-level frame
          frameTopLeft = worldToScreen(frame.bounds.x, frame.bounds.y + frame.bounds.height, viewport, canvasWidth, canvasHeight)
          frameBottomRight = worldToScreen(frame.bounds.x + frame.bounds.width, frame.bounds.y, viewport, canvasWidth, canvasHeight)
        }
        
        // Check if click point is inside frame bounds in screen coordinates
        const screenPoint: Point2D = [screenX, screenY]
        const minX = Math.min(frameTopLeft[0], frameBottomRight[0])
        const maxX = Math.max(frameTopLeft[0], frameBottomRight[0])
        const minY = Math.min(frameTopLeft[1], frameBottomRight[1])
        const maxY = Math.max(frameTopLeft[1], frameBottomRight[1])
        
        if (
          screenPoint[0] >= minX &&
          screenPoint[0] <= maxX &&
          screenPoint[1] >= minY &&
          screenPoint[1] <= maxY
        ) {
          const frameArea = (maxX - minX) * (maxY - minY)
          if (frameArea < smallestArea) {
            smallestArea = frameArea
            clickedFrame = frame
          }
        }
      }
      
      // Handle frame selection (but don't prevent panning)
      if (clickedFrame && onFrameSelected) {
        // Select the clicked frame
        onFrameSelected(clickedFrame.id)
      } else if (onFrameSelected) {
        // Clicked on background, deselect
        onFrameSelected(null)
      }
      
      // Start panning - check if inside a frame for frame-level panning
      if (clickedFrame && onFrameViewportChange) {
        // Panning inside a frame - will update frame viewport
        panningFrameRef.current = clickedFrame.id
      } else {
        // Panning background
        panningFrameRef.current = null
      }
      isPanningRef.current = true
      lastPanPointRef.current = { x: screenX, y: screenY }
    }
    e.preventDefault()
  }, [isDrawing, viewport, width, height, frames, onFrameSelected, onFrameViewportChange])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const canvasWidth = width || rect.width || 800
    const canvasHeight = height || rect.height || 600

    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    if (isDrawing) {
      handleDrawingMouseMove(screenX, screenY, canvasWidth, canvasHeight)
      return
    }

    if (isPanningRef.current && lastPanPointRef.current) {
      // Panning - check if inside a frame
      const currentPoint = { x: screenX, y: screenY }
      
      if (panningFrameRef.current && onFrameViewportChange) {
        // Panning inside a frame - update frame viewport
        const frame = frames.find(f => f.id === panningFrameRef.current)
        if (frame) {
          // Convert screen points to frame coordinates
          // First convert to parent world coordinates
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
          
          // Inverse transform: parent to frame coordinates
          const parentToFrame = (point: Point2D, frame: CoordinateFrame): Point2D => {
            const [px, py] = point
            const [originX, originY] = frame.origin
            const dx = px - originX
            const dy = py - originY
            const [iX, iY] = frame.baseI
            const [jX, jY] = frame.baseJ
            const det = iX * jY - iY * jX
            if (Math.abs(det) < 1e-10) return [0, 0]
            const invDet = 1.0 / det
            const u = (jY * dx - jX * dy) * invDet
            const v = (-iY * dx + iX * dy) * invDet
            return [u, v]
          }
          
          const lastFrame = parentToFrame(lastWorld, frame)
          const currentFrame = parentToFrame(currentWorld, frame)
          
          // Calculate pan delta in frame coordinates
          // The delta is in "unscaled" frame coordinates (as if zoom was 1.0)
          // But we need to account for frame zoom: when zoomed in, a pixel movement
          // should correspond to less movement in frame coordinates
          const frameZoom = frame.viewport.zoom
          const deltaX = (lastFrame[0] - currentFrame[0]) / frameZoom
          const deltaY = (lastFrame[1] - currentFrame[1]) / frameZoom
          
          // Update frame viewport
          onFrameViewportChange(frame.id, {
            ...frame.viewport,
            x: frame.viewport.x + deltaX,
            y: frame.viewport.y + deltaY,
          })
        }
      } else if (onViewportChange) {
        // Panning background
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
      }

      lastPanPointRef.current = currentPoint
    }
    e.preventDefault()
  }, [isDrawing, drawingRect, viewport, onViewportChange, onFrameViewportChange, frames, width, height])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    if (isDrawing) {
      const rect = container.getBoundingClientRect()
      const canvasWidth = width || rect.width || 800
      const canvasHeight = height || rect.height || 600
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      handleDrawingMouseUp(screenX, screenY, canvasWidth, canvasHeight)
      if (onDrawingModeChange) {
        onDrawingModeChange(false)
      }
    }
    
    isPanningRef.current = false
    lastPanPointRef.current = null
    panningFrameRef.current = null
  }, [isDrawing, onDrawingModeChange, width, height, handleDrawingMouseUp])

  const handleMouseLeave = useCallback(() => {
    isPanningRef.current = false
    lastPanPointRef.current = null
    panningFrameRef.current = null
  }, [])


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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }} // Prevent browser zoom on touch
      />
    </div>
  )
}


/**
 * Draw an existing frame on the canvas
 */

