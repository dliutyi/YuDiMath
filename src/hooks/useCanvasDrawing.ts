import { useState, useRef, useCallback } from 'react'
import type { ViewportState, CoordinateFrame, Point2D, FrameBounds } from '../types'
import { screenToWorld, snapPointToGrid, worldToScreen } from '../utils/coordinates'
import { screenToFrame, frameCoordsToParentWorld, parentToFrame, nestedFrameToScreen } from '../components/frameTransforms'

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
      const rawFramePoint = screenToFrame([screenX, screenY], parentFrame, viewport, canvasWidth, canvasHeight)
      const snappedRawFramePoint = snapPointToGrid(rawFramePoint, 1.0)
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

    let snappedPoint: Point2D

    if (drawingRect.parentFrame) {
      const rawFramePoint = screenToFrame([screenX, screenY], drawingRect.parentFrame, viewport, canvasWidth, canvasHeight)
      const snappedRawFramePoint = snapPointToGrid(rawFramePoint, 1.0)
      snappedPoint = frameCoordsToParentWorld(snappedRawFramePoint, drawingRect.parentFrame)
    } else {
      const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
      snappedPoint = snapPointToGrid(worldPoint, viewport.gridStep)
    }

    setDrawingRect((prev) => {
      drawingRectEndRef.current = snappedPoint
      return { ...prev, end: snappedPoint }
    })
  }, [isDrawing, drawingRect, viewport])

  const handleMouseUp = useCallback((
    screenX: number,
    screenY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    if (!isDrawing || !drawingRectStartRef.current || !onFrameCreated) return

    let startPoint: Point2D = drawingRectStartRef.current
    const parentFrame = drawingRectParentFrameRef.current

    let endPoint: Point2D

    if (parentFrame) {
      const rawFramePointEnd = screenToFrame([screenX, screenY], parentFrame, viewport, canvasWidth, canvasHeight)
      const snappedRawFramePointEnd = snapPointToGrid(rawFramePointEnd, 1.0)
      const rawFramePointStart = parentToFrame(startPoint, parentFrame)
      const snappedRawFramePointStart = snapPointToGrid(rawFramePointStart, 1.0)
      startPoint = frameCoordsToParentWorld(snappedRawFramePointStart, parentFrame)
      endPoint = frameCoordsToParentWorld(snappedRawFramePointEnd, parentFrame)
    } else {
      const worldPoint = screenToWorld(screenX, screenY, viewport, canvasWidth, canvasHeight)
      endPoint = snapPointToGrid(worldPoint, viewport.gridStep)
    }

    const [x1, y1] = startPoint
    const [x2, y2] = endPoint

    let minX = Math.min(x1, x2)
    let maxX = Math.max(x1, x2)
    let minY = Math.min(y1, y2)
    let maxY = Math.max(y1, y2)

    const frameWidth = maxX - minX
    const frameHeight = maxY - minY

    if (frameWidth > 0.1 && frameHeight > 0.1) {
      const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newBounds: FrameBounds = {
        x: minX,
        y: minY,
        width: frameWidth,
        height: frameHeight,
      }

      const parentFrameId = parentFrame?.id || null
      const originX = minX + frameWidth / 2
      const originY = minY + frameHeight / 2

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
        code: '',
        parentFrameId: parentFrameId,
        childFrameIds: [],
      }

      onFrameCreated(newFrame, parentFrameId)
    }

    // Clear drawing state
    setDrawingRect({ start: null, end: null, parentFrame: null })
    drawingRectStartRef.current = null
    drawingRectEndRef.current = null
    drawingRectParentFrameRef.current = null
  }, [isDrawing, viewport, onFrameCreated])

  return {
    drawingRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}

