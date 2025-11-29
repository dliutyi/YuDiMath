import { useState, useRef, useCallback, useEffect } from 'react'
import type { ViewportState, CoordinateFrame, Point2D, FrameBounds } from '../types'
import { screenToWorld, snapPointToGrid, worldToScreen } from '../utils/coordinates'
import { screenToFrame, parentToFrame, nestedFrameToScreen, frameCoordsToParentWorld } from '../utils/frameTransforms'
import { generateCode } from '../utils/codeGenerator'

interface UseCanvasDrawingProps {
  isDrawing: boolean
  viewport: ViewportState
  frames: CoordinateFrame[]
  width?: number
  height?: number
  onFrameCreated?: (frame: CoordinateFrame, parentFrameId: string | null) => void
}

export function useCanvasDrawing({
  isDrawing,
  viewport,
  frames,
  onFrameCreated,
}: UseCanvasDrawingProps) {
  const [drawingRect, setDrawingRect] = useState<{
    start: Point2D | null
    end: Point2D | null
    parentFrame: CoordinateFrame | null
  }>({ start: null, end: null, parentFrame: null })

  const drawingRectEndRef = useRef<Point2D | null>(null)
  const drawingRectStartRef = useRef<Point2D | null>(null)
  const drawingRectParentFrameRef = useRef<CoordinateFrame | null>(null)

  // Reset drawing state when drawing mode is activated
  useEffect(() => {
    if (isDrawing) {
      // Reset all drawing state when drawing mode is turned on
      setDrawingRect({ start: null, end: null, parentFrame: null })
      drawingRectStartRef.current = null
      drawingRectEndRef.current = null
      drawingRectParentFrameRef.current = null
    }
  }, [isDrawing])

  const findParentFrame = useCallback((
    screenX: number,
    screenY: number,
    canvasWidth: number,
    canvasHeight: number
  ): CoordinateFrame | null => {
    let parentFrame: CoordinateFrame | null = null
    let smallestArea = Infinity

    for (const frame of frames) {
      let frameTopLeft: Point2D
      let frameBottomRight: Point2D

      if (frame.parentFrameId) {
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
        frameTopLeft = worldToScreen(frame.bounds.x, frame.bounds.y + frame.bounds.height, viewport, canvasWidth, canvasHeight)
        frameBottomRight = worldToScreen(frame.bounds.x + frame.bounds.width, frame.bounds.y, viewport, canvasWidth, canvasHeight)
      }

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

    return parentFrame
  }, [frames, viewport])

  const handleMouseDown = useCallback((
    screenX: number,
    screenY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    if (!isDrawing) return

    const parentFrame = findParentFrame(screenX, screenY, canvasWidth, canvasHeight)
    
    let snappedPoint: Point2D

    if (parentFrame) {
      // Convert screen to frame coordinates (screenToFrame already returns raw frame coordinates, viewport is undone)
      const rawFramePoint = screenToFrame([screenX, screenY], parentFrame, viewport, canvasWidth, canvasHeight)
      // Snap to grid in frame coordinates (integer intervals)
      const snappedRawFramePoint = snapPointToGrid(rawFramePoint, 1.0)
      // Convert back to parent world coordinates WITHOUT viewport
      // Bounds should represent the rectangle in parent frame coordinates, not accounting for viewport
      // Use frameCoordsToParentWorld which does NOT apply viewport
      snappedPoint = frameCoordsToParentWorld(snappedRawFramePoint, parentFrame)
    } else {
      const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
      snappedPoint = snapPointToGrid(worldPoint, viewport.gridStep)
    }

    drawingRectStartRef.current = snappedPoint
    drawingRectEndRef.current = snappedPoint
    drawingRectParentFrameRef.current = parentFrame
    setDrawingRect({ start: snappedPoint, end: snappedPoint, parentFrame })
  }, [isDrawing, viewport, findParentFrame])

  const handleMouseMove = useCallback((
    screenX: number,
    screenY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    if (!isDrawing || !drawingRect.start) return

    // Look up parent frame from current frames array to ensure we have latest base vectors
    const parentFrameRef = drawingRect.parentFrame
    const parentFrame = parentFrameRef 
      ? frames.find(f => f.id === parentFrameRef.id) || parentFrameRef
      : null

    let snappedPoint: Point2D

    if (parentFrame) {
      // Convert screen to frame coordinates (screenToFrame already returns raw frame coordinates, viewport is undone)
      const rawFramePoint = screenToFrame([screenX, screenY], parentFrame, viewport, canvasWidth, canvasHeight)
      // Snap to grid in frame coordinates (integer intervals)
      const snappedRawFramePoint = snapPointToGrid(rawFramePoint, 1.0)
      // Convert back to parent world coordinates WITHOUT viewport
      // Bounds should represent the rectangle in parent frame coordinates, not accounting for viewport
      // Use frameCoordsToParentWorld which does NOT apply viewport
      snappedPoint = frameCoordsToParentWorld(snappedRawFramePoint, parentFrame)
    } else {
      const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
      snappedPoint = snapPointToGrid(worldPoint, viewport.gridStep)
    }

    setDrawingRect((prev) => {
      drawingRectEndRef.current = snappedPoint
      return { ...prev, end: snappedPoint }
    })
  }, [isDrawing, drawingRect, viewport, frames])

  const handleMouseUp = useCallback((
    screenX: number,
    screenY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    if (!isDrawing || !drawingRectStartRef.current || !onFrameCreated) return

    let startPoint: Point2D = drawingRectStartRef.current
    // Look up parent frame from current frames array to ensure we have latest base vectors
    const parentFrameRef = drawingRectParentFrameRef.current
    const parentFrame = parentFrameRef 
      ? frames.find(f => f.id === parentFrameRef.id) || parentFrameRef
      : null

    let newBounds: FrameBounds
    let snappedRawFramePointStart: Point2D | null = null
    let snappedRawFramePointEnd: Point2D | null = null

    if (parentFrame) {
      // Convert screen to frame coordinates for end point (screenToFrame already returns raw frame coordinates)
      const rawFramePointEnd = screenToFrame([screenX, screenY], parentFrame, viewport, canvasWidth, canvasHeight)
      // Snap to grid in frame coordinates (integer intervals)
      snappedRawFramePointEnd = snapPointToGrid(rawFramePointEnd, 1.0)
      
      // Convert start point from parent world to frame coordinates (raw, no viewport)
      const rawFramePointStart = parentToFrame(startPoint, parentFrame)
      // Snap to grid in frame coordinates
      snappedRawFramePointStart = snapPointToGrid(rawFramePointStart, 1.0)
      
      // Create rectangle in frame coordinates (this is the actual rectangle we want)
      const [u1, v1] = snappedRawFramePointStart
      const [u2, v2] = snappedRawFramePointEnd
      const minU = Math.min(u1, u2)
      const maxU = Math.max(u1, u2)
      const minV = Math.min(v1, v2)
      const maxV = Math.max(v1, v2)
      
      // Convert all 4 corners of the rectangle (in frame coordinates) to world coordinates
      // With non-orthogonal base vectors, this rectangle becomes a parallelogram in world space
      const topLeftWorld = frameCoordsToParentWorld([minU, maxV], parentFrame)
      const topRightWorld = frameCoordsToParentWorld([maxU, maxV], parentFrame)
      const bottomRightWorld = frameCoordsToParentWorld([maxU, minV], parentFrame)
      const bottomLeftWorld = frameCoordsToParentWorld([minU, minV], parentFrame)
      
      // Take bounding box of the 4 corners in world coordinates
      const allWorldX = [topLeftWorld[0], topRightWorld[0], bottomRightWorld[0], bottomLeftWorld[0]]
      const allWorldY = [topLeftWorld[1], topRightWorld[1], bottomRightWorld[1], bottomLeftWorld[1]]
      const minX = Math.min(...allWorldX)
      const maxX = Math.max(...allWorldX)
      const minY = Math.min(...allWorldY)
      const maxY = Math.max(...allWorldY)
      
      const frameWidth = maxX - minX
      const frameHeight = maxY - minY
      
      if (frameWidth > 0.1 && frameHeight > 0.1) {
        newBounds = {
          x: minX,
          y: minY,
          width: frameWidth,
          height: frameHeight,
          frameCoords: {
            minU,
            maxU,
            minV,
            maxV,
          },
        }
      } else {
        return
      }
    } else {
      const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
      const snappedWorldPoint = snapPointToGrid(worldPoint, viewport.gridStep)
      
      const [x1, y1] = startPoint
      const [x2, y2] = snappedWorldPoint

      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)

      const frameWidth = maxX - minX
      const frameHeight = maxY - minY

      if (frameWidth > 0.1 && frameHeight > 0.1) {
        newBounds = {
          x: minX,
          y: minY,
          width: frameWidth,
          height: frameHeight,
        }
      } else {
        return
      }
    }

    if (newBounds) {
      const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const parentFrameId = parentFrame?.id || null
      // For nested frames, calculate origin in frame coordinates, then convert to world
      let originX: number
      let originY: number
      
      if (parentFrame && snappedRawFramePointStart && snappedRawFramePointEnd) {
        // Calculate origin in frame coordinates (center of rectangle)
        const [u1, v1] = snappedRawFramePointStart
        const [u2, v2] = snappedRawFramePointEnd
        const centerU = (Math.min(u1, u2) + Math.max(u1, u2)) / 2
        const centerV = (Math.min(v1, v2) + Math.max(v1, v2)) / 2
        // Convert to world coordinates
        const originWorld = frameCoordsToParentWorld([centerU, centerV], parentFrame)
        originX = originWorld[0]
        originY = originWorld[1]
      } else {
        originX = newBounds.x + newBounds.width / 2
        originY = newBounds.y + newBounds.height / 2
      }

      let baseI: Point2D = [1, 0]
      let baseJ: Point2D = [0, 1]

      if (parentFrame) {
        baseI = [...parentFrame.baseI]
        baseJ = [...parentFrame.baseJ]
      }

      const newFrame: CoordinateFrame = {
        id: frameId,
        origin: [originX, originY],
        baseI,
        baseJ,
        parametricPlots: [],
        bounds: newBounds,
        viewport: {
          x: 0,
          y: 0,
          zoom: 1,
          gridStep: 1,
        },
        mode: '2d',
        vectors: [],
        functions: [],
        code: '', // Will be generated below
        parentFrameId: parentFrameId,
        childFrameIds: [],
      }
      
      // Generate initial code for the frame
      newFrame.code = generateCode(newFrame)

      onFrameCreated(newFrame, parentFrameId)
    }

    // Clear drawing state
    setDrawingRect({ start: null, end: null, parentFrame: null })
    drawingRectStartRef.current = null
    drawingRectEndRef.current = null
    drawingRectParentFrameRef.current = null
  }, [isDrawing, viewport, onFrameCreated, frames])

  return {
    drawingRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}

