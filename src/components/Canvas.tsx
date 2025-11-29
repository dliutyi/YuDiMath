import { useEffect, useRef, useCallback, memo, useMemo } from 'react'
import type { ViewportState, CoordinateFrame, Point2D } from '../types'
import { worldToScreen, screenToWorld, isPointInPolygon } from '../utils/coordinates'
import { drawCoordinateFrame, parentToFrame, nestedFrameToScreen } from './CoordinateFrame'
import { frameToScreen, screenToFrame, screenToNestedFrame } from '../utils/frameTransforms'
import { drawGrid, drawAxes } from '../utils/canvasDrawing'
import { useCanvasZoom } from '../hooks/useCanvasZoom'
import { useCanvasDrawing } from '../hooks/useCanvasDrawing'
import { MIN_ZOOM, MAX_ZOOM, FRAME_MIN_ZOOM, FRAME_MAX_ZOOM } from '../utils/constants'

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

function Canvas({
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
  const startWorldPointRef = useRef<Point2D | null>(null)  // World point under cursor when panning started
  const startFramePointRef = useRef<Point2D | null>(null)  // Frame point under cursor when panning started

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

  // Add global mouseup listener when drawing to handle mouseup outside canvas
  useEffect(() => {
    if (!isDrawing) return

    const handleGlobalMouseUp = (e: MouseEvent) => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container || !drawingRect?.start) return

      // Check if the mouseup is outside the canvas
      const rect = container.getBoundingClientRect()
      const isOutsideCanvas = 
        e.clientX < rect.left || 
        e.clientX > rect.right || 
        e.clientY < rect.top || 
        e.clientY > rect.bottom

      if (isOutsideCanvas) {
        // Complete drawing with the last known position or edge position
        const canvasWidth = width || rect.width || 800
        const canvasHeight = height || rect.height || 600
        // Clamp to canvas bounds
        const screenX = Math.max(0, Math.min(canvasWidth, e.clientX - rect.left))
        const screenY = Math.max(0, Math.min(canvasHeight, e.clientY - rect.top))
        handleDrawingMouseUp(screenX, screenY, canvasWidth, canvasHeight)
        if (onDrawingModeChange) {
          onDrawingModeChange(false)
        }
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp, { capture: true })
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true })
    }
  }, [isDrawing, drawingRect, width, height, handleDrawingMouseUp, onDrawingModeChange])

  // Memoize top-level frames to avoid recalculating on every render
  const topLevelFrames = useMemo(
    () => frames.filter(f => f.parentFrameId === null),
    [frames]
  )

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
        // For nested frames, start and end are in parent world coordinates
        // But they represent a rectangle in parent frame coordinates
        // So we need to:
        // 1. Convert start and end to frame coordinates
        // 2. Create rectangle in frame coordinates
        // 3. Convert all 4 corners to world coordinates
        // 4. Transform to screen
        
        const startFrame = parentToFrame(drawingRect.start, parentFrame)
        const endFrame = parentToFrame(drawingRect.end, parentFrame)
        
        // Create rectangle in frame coordinates
        const [u1, v1] = startFrame
        const [u2, v2] = endFrame
        const minU = Math.min(u1, u2)
        const maxU = Math.max(u1, u2)
        const minV = Math.min(v1, v2)
        const maxV = Math.max(v1, v2)
        
        // Transform each corner: frame coordinates -> apply viewport -> screen
        const cornersScreen: Point2D[] = [
          frameToScreen([minU, maxV], parentFrame, viewport, canvasWidth, canvasHeight), // top-left
          frameToScreen([maxU, maxV], parentFrame, viewport, canvasWidth, canvasHeight), // top-right
          frameToScreen([maxU, minV], parentFrame, viewport, canvasWidth, canvasHeight), // bottom-right
          frameToScreen([minU, minV], parentFrame, viewport, canvasWidth, canvasHeight), // bottom-left
        ]
        
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

  }, [viewport, width, height, topLevelFrames, frames, selectedFrameId, drawingRect])

  // Throttle redraws to once per frame for smoother performance
  const pendingRedrawRef = useRef<number | null>(null)
  const scheduleRedraw = useCallback(() => {
    if (pendingRedrawRef.current === null) {
      pendingRedrawRef.current = requestAnimationFrame(() => {
        draw()
        pendingRedrawRef.current = null
      })
    }
  }, [draw])

  useEffect(() => {
    // Schedule redraw when dependencies change
    scheduleRedraw()
    return () => {
      if (pendingRedrawRef.current !== null) {
        cancelAnimationFrame(pendingRedrawRef.current)
        pendingRedrawRef.current = null
      }
    }
  }, [scheduleRedraw, viewport, width, height, topLevelFrames, frames, selectedFrameId, drawingRect])

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
        // Get all 4 corners of the frame in screen coordinates
        let cornersScreen: Point2D[]
        
        if (frame.parentFrameId) {
          // Nested frame - use stored frame coordinates if available, otherwise convert from world bounds
          const parentFrameForCheck = frames.find(f => f.id === frame.parentFrameId)
          if (!parentFrameForCheck) {
            continue
          }
          
          const bounds = frame.bounds
          
          if (bounds.frameCoords) {
            // Use stored frame coordinates (the actual rectangle in frame space)
            const { minU, maxU, minV, maxV } = bounds.frameCoords
            cornersScreen = [
              frameToScreen([minU, maxV], parentFrameForCheck, viewport, canvasWidth, canvasHeight), // top-left
              frameToScreen([maxU, maxV], parentFrameForCheck, viewport, canvasWidth, canvasHeight), // top-right
              frameToScreen([maxU, minV], parentFrameForCheck, viewport, canvasWidth, canvasHeight), // bottom-right
              frameToScreen([minU, minV], parentFrameForCheck, viewport, canvasWidth, canvasHeight), // bottom-left
            ]
          } else {
            // Fallback: convert world bounds corners (may not form perfect rectangle)
            const topLeftWorld: Point2D = [bounds.x, bounds.y + bounds.height]
            const topRightWorld: Point2D = [bounds.x + bounds.width, bounds.y + bounds.height]
            const bottomRightWorld: Point2D = [bounds.x + bounds.width, bounds.y]
            const bottomLeftWorld: Point2D = [bounds.x, bounds.y]
            
            const topLeftFrame = parentToFrame(topLeftWorld, parentFrameForCheck)
            const topRightFrame = parentToFrame(topRightWorld, parentFrameForCheck)
            const bottomRightFrame = parentToFrame(bottomRightWorld, parentFrameForCheck)
            const bottomLeftFrame = parentToFrame(bottomLeftWorld, parentFrameForCheck)
            
            cornersScreen = [
              nestedFrameToScreen(topLeftFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight),
              nestedFrameToScreen(topRightFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight),
              nestedFrameToScreen(bottomRightFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight),
              nestedFrameToScreen(bottomLeftFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight),
            ]
          }
        } else {
          // Top-level frame - rectangular bounds
          const topLeft = worldToScreen(frame.bounds.x, frame.bounds.y + frame.bounds.height, viewport, canvasWidth, canvasHeight)
          const topRight = worldToScreen(frame.bounds.x + frame.bounds.width, frame.bounds.y + frame.bounds.height, viewport, canvasWidth, canvasHeight)
          const bottomRight = worldToScreen(frame.bounds.x + frame.bounds.width, frame.bounds.y, viewport, canvasWidth, canvasHeight)
          const bottomLeft = worldToScreen(frame.bounds.x, frame.bounds.y, viewport, canvasWidth, canvasHeight)
          cornersScreen = [topLeft, topRight, bottomRight, bottomLeft]
        }
        
        // Check if click point is inside the frame using point-in-polygon test
        const screenPoint: Point2D = [screenX, screenY]
        if (isPointInPolygon(screenPoint, cornersScreen)) {
          // Calculate approximate area for selecting smallest frame when overlapping
          const minX = Math.min(...cornersScreen.map(c => c[0]))
          const maxX = Math.max(...cornersScreen.map(c => c[0]))
          const minY = Math.min(...cornersScreen.map(c => c[1]))
          const maxY = Math.max(...cornersScreen.map(c => c[1]))
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
      
      // Store the world/frame point under cursor when panning starts (before viewport changes)
      if (clickedFrame && onFrameViewportChange) {
        // Store frame point
        startFramePointRef.current = clickedFrame.parentFrameId
          ? screenToNestedFrame([screenX, screenY], clickedFrame, frames, viewport, canvasWidth, canvasHeight)
          : screenToFrame([screenX, screenY], clickedFrame, viewport, canvasWidth, canvasHeight)
        startWorldPointRef.current = null
      } else {
        // Store world point
        startWorldPointRef.current = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
        startFramePointRef.current = null
      }
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
      // Panning - make the point under the cursor follow the cursor
      const currentPoint = { x: screenX, y: screenY }
      
      if (panningFrameRef.current && onFrameViewportChange && startFramePointRef.current) {
        // Panning inside a frame - update frame viewport
        const frame = frames.find(f => f.id === panningFrameRef.current)
        if (frame) {
          // Use the stored frame point from when panning started (before any viewport changes)
          const startFramePoint = startFramePointRef.current
          
          // Get the frame point that is currently under the cursor (with current viewport)
          const currentFramePoint = frame.parentFrameId
            ? screenToNestedFrame([currentPoint.x, currentPoint.y], frame, frames, viewport, canvasWidth, canvasHeight)
            : screenToFrame([currentPoint.x, currentPoint.y], frame, viewport, canvasWidth, canvasHeight)
          
          // To make startFramePoint appear at the current cursor position, adjust viewport
          const deltaX = startFramePoint[0] - currentFramePoint[0]
          const deltaY = startFramePoint[1] - currentFramePoint[1]
          
          // Update frame viewport to keep the point under the cursor
          onFrameViewportChange(frame.id, {
            ...frame.viewport,
            x: frame.viewport.x + deltaX,
            y: frame.viewport.y + deltaY,
          })
        }
      } else if (onViewportChange && startWorldPointRef.current) {
        // Panning background - make the world point under the cursor follow the cursor
        // Use the stored world point from when panning started (before any viewport changes)
        const startWorld = startWorldPointRef.current
        
        // Get the world point that is currently under the cursor (with current viewport)
        const currentWorld = screenToWorld(
          currentPoint.x,
          currentPoint.y,
          viewport,
          canvasWidth,
          canvasHeight
        )
        
        // To make startWorld appear at the current cursor position, adjust viewport
        const deltaX = startWorld[0] - currentWorld[0]
        const deltaY = startWorld[1] - currentWorld[1]

        // Update viewport to keep the point under the cursor
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
    startWorldPointRef.current = null
    startFramePointRef.current = null
  }, [isDrawing, onDrawingModeChange, width, height, handleDrawingMouseUp])

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // If drawing, complete the drawing when mouse leaves
    if (isDrawing && drawingRect?.start) {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (canvas && container) {
        const rect = container.getBoundingClientRect()
        const canvasWidth = width || rect.width || 800
        const canvasHeight = height || rect.height || 600
        // Use the last known mouse position or the edge of the canvas
        const screenX = Math.max(0, Math.min(canvasWidth, e.clientX - rect.left))
        const screenY = Math.max(0, Math.min(canvasHeight, e.clientY - rect.top))
        handleDrawingMouseUp(screenX, screenY, canvasWidth, canvasHeight)
        if (onDrawingModeChange) {
          onDrawingModeChange(false)
        }
      }
    }
    
    isPanningRef.current = false
    lastPanPointRef.current = null
    panningFrameRef.current = null
    startWorldPointRef.current = null
    startFramePointRef.current = null
  }, [isDrawing, drawingRect, width, height, handleDrawingMouseUp, onDrawingModeChange])


  // Touch handlers for mobile support
  const touchStartRef = useRef<{ x: number; y: number; distance: number } | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDrawing && e.touches.length === 1) {
      // Drawing mode - single touch starts drawing
      const touch = e.touches[0]
      const rect = e.currentTarget.getBoundingClientRect()
      const canvasWidth = width || rect.width || 800
      const canvasHeight = height || rect.height || 600
      const screenX = touch.clientX - rect.left
      const screenY = touch.clientY - rect.top
      handleDrawingMouseDown(screenX, screenY, canvasWidth, canvasHeight)
      e.preventDefault()
      return
    }
    
    if (e.touches.length === 1) {
      // Single touch - check if touching inside a frame for frame panning
      const touch = e.touches[0]
      const rect = e.currentTarget.getBoundingClientRect()
      const canvasWidth = width || rect.width || 800
      const canvasHeight = height || rect.height || 600
      const screenX = touch.clientX - rect.left
      const screenY = touch.clientY - rect.top

      // Check if touching on a frame (same logic as mouse handler)
      let clickedFrame: CoordinateFrame | null = null
      let smallestArea = Infinity
      
      for (const frame of frames) {
        let cornersScreen: Point2D[]
        
        if (frame.parentFrameId) {
          const parentFrameForCheck = frames.find(f => f.id === frame.parentFrameId)
          if (!parentFrameForCheck) {
            continue
          }
          
          const bounds = frame.bounds
          
          if (bounds.frameCoords) {
            const { minU, maxU, minV, maxV } = bounds.frameCoords
            cornersScreen = [
              frameToScreen([minU, maxV], parentFrameForCheck, viewport, canvasWidth, canvasHeight),
              frameToScreen([maxU, maxV], parentFrameForCheck, viewport, canvasWidth, canvasHeight),
              frameToScreen([maxU, minV], parentFrameForCheck, viewport, canvasWidth, canvasHeight),
              frameToScreen([minU, minV], parentFrameForCheck, viewport, canvasWidth, canvasHeight),
            ]
          } else {
            const topLeftWorld: Point2D = [bounds.x, bounds.y + bounds.height]
            const topRightWorld: Point2D = [bounds.x + bounds.width, bounds.y + bounds.height]
            const bottomRightWorld: Point2D = [bounds.x + bounds.width, bounds.y]
            const bottomLeftWorld: Point2D = [bounds.x, bounds.y]
            
            const topLeftFrame = parentToFrame(topLeftWorld, parentFrameForCheck)
            const topRightFrame = parentToFrame(topRightWorld, parentFrameForCheck)
            const bottomRightFrame = parentToFrame(bottomRightWorld, parentFrameForCheck)
            const bottomLeftFrame = parentToFrame(bottomLeftWorld, parentFrameForCheck)
            
            cornersScreen = [
              nestedFrameToScreen(topLeftFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight),
              nestedFrameToScreen(topRightFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight),
              nestedFrameToScreen(bottomRightFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight),
              nestedFrameToScreen(bottomLeftFrame, parentFrameForCheck, frames, viewport, canvasWidth, canvasHeight),
            ]
          }
        } else {
          const topLeft = worldToScreen(frame.bounds.x, frame.bounds.y + frame.bounds.height, viewport, canvasWidth, canvasHeight)
          const topRight = worldToScreen(frame.bounds.x + frame.bounds.width, frame.bounds.y + frame.bounds.height, viewport, canvasWidth, canvasHeight)
          const bottomRight = worldToScreen(frame.bounds.x + frame.bounds.width, frame.bounds.y, viewport, canvasWidth, canvasHeight)
          const bottomLeft = worldToScreen(frame.bounds.x, frame.bounds.y, viewport, canvasWidth, canvasHeight)
          cornersScreen = [topLeft, topRight, bottomRight, bottomLeft]
        }
        
        const screenPoint: Point2D = [screenX, screenY]
        if (isPointInPolygon(screenPoint, cornersScreen)) {
          const minX = Math.min(...cornersScreen.map(c => c[0]))
          const maxX = Math.max(...cornersScreen.map(c => c[0]))
          const minY = Math.min(...cornersScreen.map(c => c[1]))
          const maxY = Math.max(...cornersScreen.map(c => c[1]))
          const frameArea = (maxX - minX) * (maxY - minY)
          
          if (frameArea < smallestArea) {
            smallestArea = frameArea
            clickedFrame = frame
          }
        }
      }
      
      // Handle frame selection
      if (clickedFrame && onFrameSelected) {
        onFrameSelected(clickedFrame.id)
      } else if (onFrameSelected) {
        onFrameSelected(null)
      }
      
      // Start panning - check if inside a frame for frame-level panning
      if (clickedFrame && onFrameViewportChange) {
        panningFrameRef.current = clickedFrame.id
        // Store frame point when panning starts
        startFramePointRef.current = clickedFrame.parentFrameId
          ? screenToNestedFrame([screenX, screenY], clickedFrame, frames, viewport, canvasWidth, canvasHeight)
          : screenToFrame([screenX, screenY], clickedFrame, viewport, canvasWidth, canvasHeight)
        startWorldPointRef.current = null
      } else {
        panningFrameRef.current = null
        // Store world point when panning starts
        startWorldPointRef.current = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
        startFramePointRef.current = null
      }
      
      isPanningRef.current = true
      lastPanPointRef.current = {
        x: screenX,
        y: screenY,
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
  }, [isDrawing, width, height, handleDrawingMouseDown, frames, viewport, onFrameSelected, onFrameViewportChange])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const canvasWidth = width || rect.width || 800
    const canvasHeight = height || rect.height || 600

    if (isDrawing && e.touches.length === 1) {
      // Drawing mode - single touch continues drawing
      const touch = e.touches[0]
      const screenX = touch.clientX - rect.left
      const screenY = touch.clientY - rect.top
      handleDrawingMouseMove(screenX, screenY, canvasWidth, canvasHeight)
      e.preventDefault()
      return
    }

    if (!onViewportChange) return

    if (e.touches.length === 1 && isPanningRef.current && lastPanPointRef.current) {
      // Single touch - panning (check if frame panning or background panning)
      const touch = e.touches[0]
      const currentPoint = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }

      if (panningFrameRef.current && onFrameViewportChange) {
        // Panning inside a frame - update frame viewport
        const frame = frames.find(f => f.id === panningFrameRef.current)
        if (frame) {
          // Get the frame point that was under the touch when panning started
          const startFramePoint = frame.parentFrameId
            ? screenToNestedFrame([lastPanPointRef.current.x, lastPanPointRef.current.y], frame, frames, viewport, canvasWidth, canvasHeight)
            : screenToFrame([lastPanPointRef.current.x, lastPanPointRef.current.y], frame, viewport, canvasWidth, canvasHeight)
          
          // Get the frame point that is currently under the touch (with current viewport)
          const currentFramePoint = frame.parentFrameId
            ? screenToNestedFrame([currentPoint.x, currentPoint.y], frame, frames, viewport, canvasWidth, canvasHeight)
            : screenToFrame([currentPoint.x, currentPoint.y], frame, viewport, canvasWidth, canvasHeight)
          
          // To make startFramePoint appear at the current touch position, adjust viewport
          const deltaX = startFramePoint[0] - currentFramePoint[0]
          const deltaY = startFramePoint[1] - currentFramePoint[1]
          
          // Update frame viewport to keep the point under the touch
          onFrameViewportChange(frame.id, {
            ...frame.viewport,
            x: frame.viewport.x + deltaX,
            y: frame.viewport.y + deltaY,
          })
        }
      } else if (onViewportChange) {
        // Panning background
        // Get the world point that was under the touch when panning started
        const startWorld = screenToWorld(
          lastPanPointRef.current.x,
          lastPanPointRef.current.y,
          viewport,
          canvasWidth,
          canvasHeight
        )
        
        // Get the world point that is currently under the touch (with current viewport)
        const currentWorld = screenToWorld(
          currentPoint.x,
          currentPoint.y,
          viewport,
          canvasWidth,
          canvasHeight
        )
        
        // To make startWorld appear at the current touch position, adjust viewport
        const deltaX = startWorld[0] - currentWorld[0]
        const deltaY = startWorld[1] - currentWorld[1]

        onViewportChange({
          ...viewport,
          x: viewport.x + deltaX,
          y: viewport.y + deltaY,
        })
      }

      lastPanPointRef.current = currentPoint
    } else if (e.touches.length === 2 && touchStartRef.current) {
      // Two touches - pinch zoom (check if zooming inside a frame)
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      const scale = distance / touchStartRef.current.distance

      const centerX = ((touch1.clientX + touch2.clientX) / 2) - rect.left
      const centerY = ((touch1.clientY + touch2.clientY) / 2) - rect.top

      // Check if zooming inside a frame (use selected frame if available, otherwise check touch point)
      const zoomingFrame = selectedFrameId 
        ? frames.find(f => f.id === selectedFrameId) || null
        : null

      if (zoomingFrame && onFrameViewportChange) {
        // Zooming the selected frame
        // Use screenToNestedFrame for nested frames, screenToFrame for top-level frames
        const framePoint = zoomingFrame.parentFrameId
          ? screenToNestedFrame([centerX, centerY], zoomingFrame, frames, viewport, canvasWidth, canvasHeight)
          : screenToFrame([centerX, centerY], zoomingFrame, viewport, canvasWidth, canvasHeight)
        
        const zoomFactor = scale
        const newZoom = Math.max(FRAME_MIN_ZOOM, Math.min(FRAME_MAX_ZOOM, zoomingFrame.viewport.zoom * zoomFactor))
        
        if (Math.abs(newZoom - zoomingFrame.viewport.zoom) < 0.001) {
          touchStartRef.current.distance = distance
          e.preventDefault()
          return
        }
        
        const oldZoom = zoomingFrame.viewport.zoom
        const oldPanX = zoomingFrame.viewport.x
        const oldPanY = zoomingFrame.viewport.y
        
        const newPanX = framePoint[0] - (framePoint[0] - oldPanX) * (oldZoom / newZoom)
        const newPanY = framePoint[1] - (framePoint[1] - oldPanY) * (oldZoom / newZoom)
        
        onFrameViewportChange(zoomingFrame.id, {
          ...zoomingFrame.viewport,
          zoom: newZoom,
          x: newPanX,
          y: newPanY,
        })
      } else if (onViewportChange) {
        // Zooming background
        const worldBefore = screenToWorld(centerX, centerY, viewport, canvasWidth, canvasHeight)

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
      }

      touchStartRef.current.distance = distance
    }

    e.preventDefault()
  }, [isDrawing, viewport, onViewportChange, onFrameViewportChange, frames, selectedFrameId, width, height, MIN_ZOOM, MAX_ZOOM, FRAME_MIN_ZOOM, FRAME_MAX_ZOOM, handleDrawingMouseMove])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const container = containerRef.current
    
    if (isDrawing && e.touches.length === 0 && container) {
      // Drawing mode - touch ended, finish drawing
      const rect = container.getBoundingClientRect()
      const canvasWidth = width || rect.width || 800
      const canvasHeight = height || rect.height || 600
      
      // Use the last touch point from changedTouches (the touch that just ended)
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0]
        const screenX = touch.clientX - rect.left
        const screenY = touch.clientY - rect.top
        handleDrawingMouseUp(screenX, screenY, canvasWidth, canvasHeight)
        if (onDrawingModeChange) {
          onDrawingModeChange(false)
        }
      }
    }
    
    isPanningRef.current = false
    lastPanPointRef.current = null
    touchStartRef.current = null
  }, [isDrawing, width, height, handleDrawingMouseUp, onDrawingModeChange])

  return (
    <div
      ref={containerRef}
      data-canvas-container
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

export default memo(Canvas)


/**
 * Draw an existing frame on the canvas
 */

