import { useEffect, useRef, useCallback, useState } from 'react'
import type { ViewportState, CoordinateFrame, Point2D, FrameBounds } from '../types'
import {
  worldToScreen,
  screenToWorld,
  snapPointToGrid,
  isFrameInsideFrame,
  clampPointToFrameBounds,
  isPointInFrame,
} from '../utils/coordinates'
import { drawCoordinateFrame, screenToFrame, frameToParent, parentToFrame, nestedFrameToScreen } from './CoordinateFrame'

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
  const panningFrameRef = useRef<string | null>(null) // Track which frame is being panned
  
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
      drawCoordinateFrame(ctx, frame, viewport, canvasWidth, canvasHeight, frames, selectedFrameId, 0)
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
  }, [viewport, width, height, drawingRect, frames, selectedFrameId])

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
  // Handle zoom logic here instead of React handler to avoid passive listener issues
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const wheelHandler = (e: WheelEvent) => {
      // Prevent browser zoom
      e.preventDefault()
      e.stopPropagation()

      const rect = container.getBoundingClientRect()
      const canvasWidth = width || rect.width || 800
      const canvasHeight = height || rect.height || 600

      // Get mouse position relative to canvas
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Check if mouse is inside a frame
      const worldPoint = screenToWorld(mouseX, mouseY, viewport, canvasWidth, canvasHeight)
      let zoomingFrame: CoordinateFrame | null = null
      let smallestArea = Infinity
      
      for (const frame of frames) {
        if (isPointInFrame(worldPoint, frame.bounds)) {
          const frameArea = frame.bounds.width * frame.bounds.height
          if (frameArea < smallestArea) {
            smallestArea = frameArea
            zoomingFrame = frame
          }
        }
      }

      if (zoomingFrame && onFrameViewportChange) {
        // Zooming inside a frame - update frame viewport
        // Convert mouse position to frame coordinates
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
        
        const framePoint = parentToFrame(worldPoint, zoomingFrame)
        
        // Frame zoom is relative (1.0 = default), so use different constraints
        // Frame zoom should be independent of parent zoom
        const FRAME_MIN_ZOOM = 0.1  // 10x zoomed out
        const FRAME_MAX_ZOOM = 10.0 // 10x zoomed in
        const FRAME_ZOOM_SENSITIVITY = 0.005 // Lower sensitivity for smoother zoom
        
        // Calculate new zoom level using multiplicative zoom (more natural)
        // Use exponential scaling: zoomDelta = e^(sensitivity * deltaY)
        const zoomFactor = Math.exp(-e.deltaY * FRAME_ZOOM_SENSITIVITY)
        const newZoom = Math.max(FRAME_MIN_ZOOM, Math.min(FRAME_MAX_ZOOM, zoomingFrame.viewport.zoom * zoomFactor))
        
        // If zoom didn't change (hit constraint), don't update
        if (Math.abs(newZoom - zoomingFrame.viewport.zoom) < 0.001) return
        
        // To keep the point under the mouse fixed, we need to adjust the frame pan
        // The point in frame coordinates is framePoint
        // Before zoom: framePoint maps to screen position (mouseX, mouseY)
        // After zoom: we want framePoint to still map to (mouseX, mouseY)
        // The pan adjustment is: (framePoint - oldPan) * (oldZoom / newZoom) - (framePoint - newPan) = 0
        // Solving: newPan = framePoint - (framePoint - oldPan) * (oldZoom / newZoom)
        const oldZoom = zoomingFrame.viewport.zoom
        const oldPanX = zoomingFrame.viewport.x
        const oldPanY = zoomingFrame.viewport.y
        
        const newPanX = framePoint[0] - (framePoint[0] - oldPanX) * (oldZoom / newZoom)
        const newPanY = framePoint[1] - (framePoint[1] - oldPanY) * (oldZoom / newZoom)
        
        // Update frame viewport
        onFrameViewportChange(zoomingFrame.id, {
          ...zoomingFrame.viewport,
          zoom: newZoom,
          x: newPanX,
          y: newPanY,
        })
      } else if (onViewportChange) {
        // Zooming background
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
      }
    }

    // Use capture phase and non-passive to ensure we can preventDefault
    canvas.addEventListener('wheel', wheelHandler, { passive: false, capture: true })
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler, { capture: true } as EventListenerOptions)
    }
  }, [viewport, onViewportChange, onFrameViewportChange, frames, width, height, MIN_ZOOM, MAX_ZOOM, ZOOM_SENSITIVITY])

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
      // First, find the innermost parent frame that contains the click point
      // We need to check in screen space, accounting for each frame's viewport
      let parentFrame: CoordinateFrame | null = null
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
            parentFrame = frame
          }
        }
      }
      
      let snappedPoint: Point2D
      
      if (parentFrame) {
        // Convert screen coordinates directly to parent frame coordinates
        // This accounts for the parent's viewport pan/zoom
        // screenToFrame returns coordinates in the frame's coordinate system accounting for viewport
        const framePoint = screenToFrame([screenX, screenY], parentFrame, viewport, canvasWidth, canvasHeight)
        
        // In frame coordinates, grid step is always 1.0
        // Snap directly in the frame coordinate system (which accounts for viewport)
        const snappedFramePoint = snapPointToGrid(framePoint, 1.0)
        
        // Convert back to parent world coordinates using frameToParent
        // frameToParent applies the viewport transformation, which matches what screenToFrame did
        // This ensures the coordinates are correctly transformed back to parent world space
        snappedPoint = frameToParent(snappedFramePoint, parentFrame)
      } else {
        // Snap to background grid
        const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
        snappedPoint = snapPointToGrid(worldPoint, viewport.gridStep)
      }
      
      console.log('[Canvas] Starting rectangle drawing at:', snappedPoint, 'parent frame:', parentFrame?.id)
      setDrawingRect({ start: snappedPoint, end: snappedPoint, parentFrame })
    } else {
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
        console.log('[Canvas] Frame clicked:', clickedFrame.id)
        onFrameSelected(clickedFrame.id)
      } else if (onFrameSelected) {
        // Clicked on background, deselect
        console.log('[Canvas] Background clicked, deselecting frame')
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

    if (isDrawing && drawingRect.start) {
      // Update rectangle drawing
      let snappedPoint: Point2D
      
      if (drawingRect.parentFrame) {
        // Convert to parent frame coordinates and snap there
        const framePoint = screenToFrame([screenX, screenY], drawingRect.parentFrame, viewport, canvasWidth, canvasHeight)
        // In frame coordinates, grid step is always 1.0
        const snappedFramePoint = snapPointToGrid(framePoint, 1.0)
        // Convert back to world coordinates
        snappedPoint = frameToParent(snappedFramePoint, drawingRect.parentFrame)
        // Constrain to parent frame bounds
        snappedPoint = clampPointToFrameBounds(snappedPoint, drawingRect.parentFrame.bounds)
        console.log('[Canvas] Mouse move - frame point:', framePoint, 'snapped:', snappedFramePoint, 'world:', snappedPoint)
      } else {
        // Snap to background grid
        const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
        snappedPoint = snapPointToGrid(worldPoint, viewport.gridStep)
      }
      
      setDrawingRect((prev) => ({ ...prev, end: snappedPoint }))
    } else if (isPanningRef.current && lastPanPointRef.current) {
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

    console.log('[Canvas] Mouse up - isDrawing:', isDrawing, 'drawingRect:', drawingRect)

    if (isDrawing && drawingRect.start) {
      // Get current mouse position for end point
      const rect = container.getBoundingClientRect()
      const canvasWidth = width || rect.width || 800
      const canvasHeight = height || rect.height || 600
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      let endPoint: Point2D
      
      if (drawingRect.parentFrame) {
        // Convert screen coordinates directly to parent frame coordinates
        // This accounts for the parent's viewport pan/zoom
        // screenToFrame returns coordinates in the frame's coordinate system accounting for viewport
        const framePoint = screenToFrame([screenX, screenY], drawingRect.parentFrame, viewport, canvasWidth, canvasHeight)
        
        // In frame coordinates, grid step is always 1.0
        // Snap directly in the frame coordinate system (which accounts for viewport)
        const snappedFramePoint = snapPointToGrid(framePoint, 1.0)
        
        // Convert back to parent world coordinates using frameToParent
        // frameToParent applies the viewport transformation, which matches what screenToFrame did
        // This ensures the coordinates are correctly transformed back to parent world space
        endPoint = frameToParent(snappedFramePoint, drawingRect.parentFrame)
        // Constrain to parent frame bounds
        endPoint = clampPointToFrameBounds(endPoint, drawingRect.parentFrame.bounds)
      } else {
        // Snap to background grid
        const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
        endPoint = drawingRect.end || snapPointToGrid(worldPoint, viewport.gridStep)
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

          // Initialize frame with its own viewport state (independent panning and zooming)
          const newFrame: CoordinateFrame = {
            id: frameId,
            origin: [originX, originY],
            baseI,
            baseJ,
            bounds: newBounds,
            viewport: {
              x: 0, // Frame's own pan offset in frame coordinates
              y: 0,
              zoom: 1.0, // Frame's own zoom level (1.0 = default, scales relative to base vectors)
              gridStep: 1, // Frame's grid step (based on base vectors, not used for grid but kept for consistency)
            },
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
    panningFrameRef.current = null
  }, [isDrawing, drawingRect, onFrameCreated, onDrawingModeChange, viewport, width, height, frames, onFrameViewportChange])

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

  // Set grid line style - semi-transparent background grid
  // Less visible inside frames to reduce confusion
  ctx.strokeStyle = '#475569' // slate-600
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.25 // Less visible to reduce confusion inside frames

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

