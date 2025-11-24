import { useEffect } from 'react'
import type { ViewportState, CoordinateFrame } from '../types'
import { screenToWorld } from '../utils/coordinates'
import { screenToFrame } from '../utils/frameTransforms'

interface UseCanvasZoomProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  containerRef: React.RefObject<HTMLDivElement>
  viewport: ViewportState
  frames: CoordinateFrame[]
  selectedFrameId: string | null
  width?: number
  height?: number
  onViewportChange?: (viewport: ViewportState) => void
  onFrameViewportChange?: (frameId: string, viewport: ViewportState) => void
}

const MIN_ZOOM = 5.0
const MAX_ZOOM = 500.0
const ZOOM_SENSITIVITY = 0.1
const FRAME_MIN_ZOOM = 0.1
const FRAME_MAX_ZOOM = 10.0
const FRAME_ZOOM_SENSITIVITY = 0.005

export function useCanvasZoom({
  canvasRef,
  containerRef,
  viewport,
  frames,
  selectedFrameId,
  width,
  height,
  onViewportChange,
  onFrameViewportChange,
}: UseCanvasZoomProps) {
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = container.getBoundingClientRect()
      const canvasWidth = width || rect.width || 800
      const canvasHeight = height || rect.height || 600

      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Use selected frame for zooming instead of hovered frame
      const zoomingFrame = selectedFrameId 
        ? frames.find(f => f.id === selectedFrameId) || null
        : null

      if (zoomingFrame && onFrameViewportChange) {
        // Zooming the selected frame
        // Use screenToFrame which properly accounts for frame viewport pan/zoom
        const framePoint = screenToFrame([mouseX, mouseY], zoomingFrame, viewport, canvasWidth, canvasHeight)
        
        const zoomFactor = Math.exp(-e.deltaY * FRAME_ZOOM_SENSITIVITY)
        const newZoom = Math.max(FRAME_MIN_ZOOM, Math.min(FRAME_MAX_ZOOM, zoomingFrame.viewport.zoom * zoomFactor))
        
        if (Math.abs(newZoom - zoomingFrame.viewport.zoom) < 0.001) return
        
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
        const worldBefore = screenToWorld(mouseX, mouseY, viewport, canvasWidth, canvasHeight)

        const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom + zoomDelta))

        if (newZoom === viewport.zoom) return

        const newViewport: ViewportState = {
          ...viewport,
          zoom: newZoom,
        }

        const worldAfter = screenToWorld(mouseX, mouseY, newViewport, canvasWidth, canvasHeight)

        onViewportChange({
          ...newViewport,
          x: viewport.x + (worldBefore[0] - worldAfter[0]),
          y: viewport.y + (worldBefore[1] - worldAfter[1]),
        })
      }
    }

    canvas.addEventListener('wheel', wheelHandler, { passive: false, capture: true })
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler, { capture: true } as EventListenerOptions)
    }
  }, [viewport, onViewportChange, onFrameViewportChange, frames, selectedFrameId, width, height])
}

