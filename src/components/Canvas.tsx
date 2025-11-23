import { useEffect, useRef, useCallback, useState } from 'react'
import type { ViewportState, CoordinateFrame, Point2D, FrameBounds } from '../types'
import {
  worldToScreen,
  screenToWorld,
  snapPointToGrid,
  clampPointToFrameBounds,
  isPointInFrame,
} from '../utils/coordinates'
import { drawCoordinateFrame, screenToFrame, frameToParent, frameCoordsToParentWorld, parentToFrame, nestedFrameToScreen } from './CoordinateFrame'

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
  
  // Use refs to track the latest drawingRect values to avoid stale closures
  const drawingRectEndRef = useRef<Point2D | null>(null)
  const drawingRectStartRef = useRef<Point2D | null>(null)
  const drawingRectParentFrameRef = useRef<CoordinateFrame | null>(null)
  
  // Zoom constraints
  // Default zoom is 50 (1 unit = 50px), so min/max are relative to that
  const MIN_ZOOM = 5.0   // 1 unit = 5px (zoomed out)
  const MAX_ZOOM = 500.0 // 1 unit = 500px (zoomed in)
  const ZOOM_SENSITIVITY = 0.1 // 10x more sensitive than before (was 0.01)

  const draw = () => {
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
      
      if (drawingRect.parentFrame) {
        // For nested frames, use the same transformation as nested frame bounds rendering
        // Convert parent world coordinates to parent frame coordinates (raw)
        const topLeftWorld: Point2D = [minX, maxY]
        const bottomRightWorld: Point2D = [maxX, minY]
        console.error('[Canvas] DRAWING RECT RENDER - bounds (parent world):', {minX, maxX, minY, maxY}, 'topLeftWorld:', topLeftWorld, 'bottomRightWorld:', bottomRightWorld)
        
        const topLeftFrame = parentToFrame(topLeftWorld, drawingRect.parentFrame)
        const bottomRightFrame = parentToFrame(bottomRightWorld, drawingRect.parentFrame)
        console.error('[Canvas] DRAWING RECT RENDER - parent frame coords - topLeft:', topLeftFrame, 'bottomRight:', bottomRightFrame, 'parent viewport:', drawingRect.parentFrame.viewport)
        
        // Apply parent frame's viewport transformation
        const topLeftFrameWithViewport: Point2D = [
          (topLeftFrame[0] - drawingRect.parentFrame.viewport.x) * drawingRect.parentFrame.viewport.zoom,
          (topLeftFrame[1] - drawingRect.parentFrame.viewport.y) * drawingRect.parentFrame.viewport.zoom
        ]
        const bottomRightFrameWithViewport: Point2D = [
          (bottomRightFrame[0] - drawingRect.parentFrame.viewport.x) * drawingRect.parentFrame.viewport.zoom,
          (bottomRightFrame[1] - drawingRect.parentFrame.viewport.y) * drawingRect.parentFrame.viewport.zoom
        ]
        console.error('[Canvas] DRAWING RECT RENDER - after viewport - topLeft:', topLeftFrameWithViewport, 'bottomRight:', bottomRightFrameWithViewport)
        
        // Transform back to parent world coordinates using base vectors
        const [originX, originY] = drawingRect.parentFrame.origin
        const [iX, iY] = drawingRect.parentFrame.baseI
        const [jX, jY] = drawingRect.parentFrame.baseJ
        
        const topLeftParentWorldWithViewport: Point2D = [
          originX + topLeftFrameWithViewport[0] * iX + topLeftFrameWithViewport[1] * jX,
          originY + topLeftFrameWithViewport[0] * iY + topLeftFrameWithViewport[1] * jY
        ]
        const bottomRightParentWorldWithViewport: Point2D = [
          originX + bottomRightFrameWithViewport[0] * iX + bottomRightFrameWithViewport[1] * jX,
          originY + bottomRightFrameWithViewport[0] * iY + bottomRightFrameWithViewport[1] * jY
        ]
        console.error('[Canvas] DRAWING RECT RENDER - parent world with viewport - topLeft:', topLeftParentWorldWithViewport, 'bottomRight:', bottomRightParentWorldWithViewport)
        
        // Transform to screen using root viewport
        topLeft = worldToScreen(topLeftParentWorldWithViewport[0], topLeftParentWorldWithViewport[1], viewport, canvasWidth, canvasHeight)
        bottomRight = worldToScreen(bottomRightParentWorldWithViewport[0], bottomRightParentWorldWithViewport[1], viewport, canvasWidth, canvasHeight)
        console.error('[Canvas] DRAWING RECT RENDER - screen coords - topLeft:', topLeft, 'bottomRight:', bottomRight)
      } else {
        topLeft = worldToScreen(minX, maxY, viewport, canvasWidth, canvasHeight)
        bottomRight = worldToScreen(maxX, minY, viewport, canvasWidth, canvasHeight)
      }

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
        // For nested frames, use screenToFrame which correctly accounts for parent frame's viewport
        // screenToFrame: screen -> parent world (using root viewport) -> frame coords (accounting for frame viewport)
        // It returns raw frame coordinates (already has viewport pan undone)
        // frameToScreen does: u -> (u - viewport.x) -> scaled -> parent world
        // screenToFrame does: parent world -> scaled -> (scaled/zoom) -> (scaled/zoom + viewport.x) = u
        // So screenToFrame already returns the raw frame coordinate u
        const rawFramePoint = screenToFrame([screenX, screenY], parentFrame, viewport, canvasWidth, canvasHeight)
        
        console.error('[Canvas] MOUSE DOWN - screen:', [screenX, screenY], 'root viewport:', viewport)
        console.error('[Canvas] MOUSE DOWN - raw frame coords from screenToFrame:', rawFramePoint)
        console.error('[Canvas] MOUSE DOWN - parent frame viewport:', parentFrame.viewport)
        
        // In frame coordinates, grid step is always 1.0
        let snappedRawFramePoint = snapPointToGrid(rawFramePoint, 1.0)
        console.error('[Canvas] MOUSE DOWN - snapped raw frame point:', snappedRawFramePoint)
        
        // Clamp raw frame coordinates to parent frame bounds in frame coordinate space
        // Convert parent bounds corners to frame coordinates
        const parentBounds = parentFrame.bounds
        const bottomLeftWorld: Point2D = [parentBounds.x, parentBounds.y]
        const topRightWorld: Point2D = [parentBounds.x + parentBounds.width, parentBounds.y + parentBounds.height]
        const bottomLeftFrame = parentToFrame(bottomLeftWorld, parentFrame)
        const topRightFrame = parentToFrame(topRightWorld, parentFrame)
        const minU = Math.min(bottomLeftFrame[0], topRightFrame[0])
        const maxU = Math.max(bottomLeftFrame[0], topRightFrame[0])
        const minV = Math.min(bottomLeftFrame[1], topRightFrame[1])
        const maxV = Math.max(bottomLeftFrame[1], topRightFrame[1])
        console.error('[Canvas] MOUSE DOWN - frame bounds in frame coords: minU:', minU, 'maxU:', maxU, 'minV:', minV, 'maxV:', maxV)
        
        // Clamp snapped raw frame point to frame bounds
        const beforeClamp = [...snappedRawFramePoint]
        snappedRawFramePoint = [
          Math.max(minU, Math.min(maxU, snappedRawFramePoint[0])),
          Math.max(minV, Math.min(maxV, snappedRawFramePoint[1]))
        ]
        if (beforeClamp[0] !== snappedRawFramePoint[0] || beforeClamp[1] !== snappedRawFramePoint[1]) {
          console.error('[Canvas] MOUSE DOWN - CLAMPED from:', beforeClamp, 'to:', snappedRawFramePoint)
        }
        
        // Convert raw frame coordinates to parent world coordinates
        // This ensures bounds are stored correctly regardless of parent's viewport state
        snappedPoint = frameCoordsToParentWorld(snappedRawFramePoint, parentFrame)
        console.error('[Canvas] MOUSE DOWN - final world point:', snappedPoint)
        
      } else {
        // Snap to background grid
        const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
        snappedPoint = snapPointToGrid(worldPoint, viewport.gridStep)
      }
      
      drawingRectStartRef.current = snappedPoint
      drawingRectEndRef.current = snappedPoint
      drawingRectParentFrameRef.current = parentFrame
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

    if (isDrawing && drawingRect.start) {
      // Update rectangle drawing
      let snappedPoint: Point2D
      
      if (drawingRect.parentFrame) {
        // For nested frames, use screenToFrame which correctly accounts for parent frame's viewport
        // screenToFrame already returns raw frame coordinates
        const rawFramePoint = screenToFrame([screenX, screenY], drawingRect.parentFrame, viewport, canvasWidth, canvasHeight)
        console.error('[Canvas] MOUSE MOVE - screen:', [screenX, screenY], 'raw frame:', rawFramePoint, 'parent frame viewport:', drawingRect.parentFrame.viewport)
        
        // In frame coordinates, grid step is always 1.0
        let snappedRawFramePoint = snapPointToGrid(rawFramePoint, 1.0)
        console.error('[Canvas] MOUSE MOVE - snapped raw frame point:', snappedRawFramePoint)
        
        // Clamp raw frame coordinates to parent frame bounds in frame coordinate space
        // Convert parent bounds corners to frame coordinates
        const parentBounds = drawingRect.parentFrame.bounds
        const bottomLeftWorld: Point2D = [parentBounds.x, parentBounds.y]
        const topRightWorld: Point2D = [parentBounds.x + parentBounds.width, parentBounds.y + parentBounds.height]
        const bottomLeftFrame = parentToFrame(bottomLeftWorld, drawingRect.parentFrame)
        const topRightFrame = parentToFrame(topRightWorld, drawingRect.parentFrame)
        const minU = Math.min(bottomLeftFrame[0], topRightFrame[0])
        const maxU = Math.max(bottomLeftFrame[0], topRightFrame[0])
        const minV = Math.min(bottomLeftFrame[1], topRightFrame[1])
        const maxV = Math.max(bottomLeftFrame[1], topRightFrame[1])
        
        // Clamp snapped raw frame point to frame bounds
        snappedRawFramePoint = [
          Math.max(minU, Math.min(maxU, snappedRawFramePoint[0])),
          Math.max(minV, Math.min(maxV, snappedRawFramePoint[1]))
        ]
        
        // Convert raw frame coordinates to parent world coordinates
        // This ensures bounds are stored correctly regardless of parent's viewport state
        snappedPoint = frameCoordsToParentWorld(snappedRawFramePoint, drawingRect.parentFrame)
        console.error('[Canvas] MOUSE MOVE - final snapped point (parent world):', snappedPoint)
      } else {
        // Snap to background grid
        const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
        snappedPoint = snapPointToGrid(worldPoint, viewport.gridStep)
      }
      
      setDrawingRect((prev) => {
        drawingRectEndRef.current = snappedPoint
        return { ...prev, end: snappedPoint }
      })
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


    if (isDrawing && drawingRectStartRef.current) {
      // Use refs to get the latest values to avoid stale closures
      const startPoint: Point2D = drawingRectStartRef.current
      const parentFrame = drawingRectParentFrameRef.current
      
      // Recalculate end point using the same logic as handleMouseMove
      // This ensures we use the exact mouse position at mouse up time
      const rect = container.getBoundingClientRect()
      const canvasWidth = width || rect.width || 800
      const canvasHeight = height || rect.height || 600
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      
      let endPoint: Point2D
      
      if (parentFrame) {
        // Convert screen to parent world coordinates first (using main viewport)
        const parentWorldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
        console.error('[Canvas] MOUSE UP - screen:', [screenX, screenY], 'parent world:', parentWorldPoint)
        
        // Convert parent world coordinates to parent frame coordinates (without viewport)
        // This gives us the "raw" frame coordinates, not accounting for parent's viewport pan/zoom
        const rawFramePoint = parentToFrame(parentWorldPoint, parentFrame)
        console.error('[Canvas] MOUSE UP - raw frame point:', rawFramePoint, 'parent origin:', parentFrame.origin)
        
        // In frame coordinates, grid step is always 1.0
        let snappedRawFramePoint = snapPointToGrid(rawFramePoint, 1.0)
        console.error('[Canvas] MOUSE UP - snapped raw frame point:', snappedRawFramePoint)
        
        // Clamp raw frame coordinates to parent frame bounds in frame coordinate space
        // Convert parent bounds corners to frame coordinates
        const parentBounds = parentFrame.bounds
        const bottomLeftWorld: Point2D = [parentBounds.x, parentBounds.y]
        const topRightWorld: Point2D = [parentBounds.x + parentBounds.width, parentBounds.y + parentBounds.height]
        const bottomLeftFrame = parentToFrame(bottomLeftWorld, parentFrame)
        const topRightFrame = parentToFrame(topRightWorld, parentFrame)
        const minU = Math.min(bottomLeftFrame[0], topRightFrame[0])
        const maxU = Math.max(bottomLeftFrame[0], topRightFrame[0])
        const minV = Math.min(bottomLeftFrame[1], topRightFrame[1])
        const maxV = Math.max(bottomLeftFrame[1], topRightFrame[1])
        console.error('[Canvas] MOUSE UP - frame bounds in frame coords: minU:', minU, 'maxU:', maxU, 'minV:', minV, 'maxV:', maxV)
        
        // Clamp snapped raw frame point to frame bounds
        const beforeClamp = [...snappedRawFramePoint]
        snappedRawFramePoint = [
          Math.max(minU, Math.min(maxU, snappedRawFramePoint[0])),
          Math.max(minV, Math.min(maxV, snappedRawFramePoint[1]))
        ]
        if (beforeClamp[0] !== snappedRawFramePoint[0] || beforeClamp[1] !== snappedRawFramePoint[1]) {
          console.error('[Canvas] MOUSE UP - CLAMPED from:', beforeClamp, 'to:', snappedRawFramePoint)
        }
        
        // Convert raw frame coordinates to parent world coordinates
        // This ensures bounds are stored correctly regardless of parent's viewport state
        endPoint = frameCoordsToParentWorld(snappedRawFramePoint, parentFrame)
        console.error('[Canvas] MOUSE UP - final endPoint world:', endPoint)
        console.error('[Canvas] MOUSE UP - startPoint from ref:', startPoint)
      } else {
        // Snap to background grid
        const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
        endPoint = snapPointToGrid(worldPoint, viewport.gridStep)
      }


      if (onFrameCreated) {
        // Finalize rectangle and create frame
        // IMPORTANT: startPoint and endPoint are both in parent world coordinates
        // For nested frames, they're relative to the parent frame's coordinate system
        const [x1, y1] = startPoint
        const [x2, y2] = endPoint
        
        console.error('[Canvas] ===== FRAME CREATION =====')
        console.error('[Canvas] startPoint:', startPoint, 'endPoint:', endPoint)
        if (parentFrame) {
          const startRaw = parentToFrame(startPoint, parentFrame)
          const endRaw = parentToFrame(endPoint, parentFrame)
          console.error('[Canvas] startPoint raw frame:', startRaw, 'endPoint raw frame:', endRaw)
          console.error('[Canvas] parent frame origin:', parentFrame.origin, 'bounds:', parentFrame.bounds)
        }
        
        // Calculate bounds (ensure positive width and height)
        let minX = Math.min(x1, x2)
        let maxX = Math.max(x1, x2)
        let minY = Math.min(y1, y2)
        let maxY = Math.max(y1, y2)
        
        console.log('[Canvas] Before parent clamp - minX:', minX, 'maxX:', maxX, 'minY:', minY, 'maxY:', maxY)
        
        // If drawing inside a parent frame, constrain bounds to stay within parent
        if (parentFrame) {
          const parentBounds = parentFrame.bounds
          const minXBefore = minX
          const maxXBefore = maxX
          const minYBefore = minY
          const maxYBefore = maxY
          minX = Math.max(parentBounds.x, minX)
          maxX = Math.min(parentBounds.x + parentBounds.width, maxX)
          minY = Math.max(parentBounds.y, minY)
          maxY = Math.min(parentBounds.y + parentBounds.height, maxY)
          if (minX !== minXBefore || maxX !== maxXBefore || minY !== minYBefore || maxY !== maxYBefore) {
            console.log('[Canvas] After parent clamp - minX:', minX, 'maxX:', maxX, 'minY:', minY, 'maxY:', maxY)
          }
        }
        
        const frameWidth = maxX - minX
        const frameHeight = maxY - minY
        console.log('[Canvas] Final bounds - width:', frameWidth, 'height:', frameHeight)
        
        // Only create frame if it has minimum size
        if (frameWidth > 0.1 && frameHeight > 0.1) {
          const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const newBounds: FrameBounds = {
            x: minX,
            y: minY,
            width: frameWidth,
            height: frameHeight,
          }

          // Use the parent frame from the ref (the one we were drawing inside)
          const parentFrameId = parentFrame?.id || null
          

          // Set origin to the center of the frame viewport
          const originX = minX + frameWidth / 2
          const originY = minY + frameHeight / 2

          // Inherit base vectors from parent frame, or use defaults for top-level frames
          // Default base vectors correspond to unit steps horizontally and vertically
          let baseI: Point2D = [1, 0]
          let baseJ: Point2D = [0, 1]
          
          if (parentFrame) {
            // Inherit base vectors from parent
            baseI = [...parentFrame.baseI]
            baseJ = [...parentFrame.baseJ]
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
          console.log('[Canvas] Creating frame - bounds:', newBounds, 'parent:', parentFrameId)
          onFrameCreated(newFrame, parentFrameId)
        } else {
        }
      }
      
      // Reset drawing state
      drawingRectStartRef.current = null
      drawingRectEndRef.current = null
      drawingRectParentFrameRef.current = null
      setDrawingRect({ start: null, end: null, parentFrame: null })
      if (onDrawingModeChange) {
        onDrawingModeChange(false)
      }
    }
    
    isPanningRef.current = false
    lastPanPointRef.current = null
    panningFrameRef.current = null
  }, [isDrawing, drawingRect, onFrameCreated, onDrawingModeChange, viewport, width, height, frames, onFrameViewportChange, screenToFrame, frameToParent, screenToWorld, snapPointToGrid, clampPointToFrameBounds])

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

