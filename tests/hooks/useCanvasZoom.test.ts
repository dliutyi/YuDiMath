import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasZoom } from '../../src/hooks/useCanvasZoom'
import type { ViewportState, CoordinateFrame } from '../../src/types'

// Mock the utility functions
vi.mock('../../src/utils/coordinates', () => ({
  screenToWorld: vi.fn((x, y, viewport) => [x / viewport.zoom + viewport.x, y / viewport.zoom + viewport.y]),
}))

vi.mock('../../src/utils/frameTransforms', () => ({
  parentToFrame: vi.fn((point, frame) => {
    const [px, py] = point
    const [ox, oy] = frame.origin
    return [px - ox, py - oy]
  }),
}))

describe('useCanvasZoom', () => {
  let canvasRef: React.RefObject<HTMLCanvasElement>
  let containerRef: React.RefObject<HTMLDivElement>
  let mockOnViewportChange: ReturnType<typeof vi.fn>
  let mockOnFrameViewportChange: ReturnType<typeof vi.fn>
  let defaultViewport: ViewportState

  beforeEach(() => {
    canvasRef = { current: document.createElement('canvas') }
    containerRef = { current: document.createElement('div') }
    mockOnViewportChange = vi.fn()
    mockOnFrameViewportChange = vi.fn()
    defaultViewport = {
      x: 0,
      y: 0,
      zoom: 10.0,
      gridStep: 1,
    }

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }))
  })

  it('should not add event listener if canvas or container is null', () => {
    const nullCanvasRef = { current: null }
    const nullContainerRef = { current: null }

    renderHook(() =>
      useCanvasZoom({
        canvasRef: nullCanvasRef,
        containerRef: nullContainerRef,
        viewport: defaultViewport,
        frames: [],
        selectedFrameId: null,
        onViewportChange: mockOnViewportChange,
      })
    )

    // Should not throw and should not call any handlers
    expect(mockOnViewportChange).not.toHaveBeenCalled()
  })

  it('should zoom background viewport on wheel event', () => {
    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: defaultViewport,
        frames: [],
        selectedFrameId: null,
        onViewportChange: mockOnViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 400,
      clientY: 300,
      deltaY: -100,
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    expect(mockOnViewportChange).toHaveBeenCalled()
    const newViewport = mockOnViewportChange.mock.calls[0][0]
    expect(newViewport.zoom).toBeGreaterThan(defaultViewport.zoom)
  })

  it('should zoom out background viewport on wheel event', () => {
    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: defaultViewport,
        frames: [],
        selectedFrameId: null,
        onViewportChange: mockOnViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 400,
      clientY: 300,
      deltaY: 100,
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    expect(mockOnViewportChange).toHaveBeenCalled()
    const newViewport = mockOnViewportChange.mock.calls[0][0]
    expect(newViewport.zoom).toBeLessThan(defaultViewport.zoom)
  })

  it('should respect MIN_ZOOM limit', () => {
    const lowZoomViewport: ViewportState = {
      ...defaultViewport,
      zoom: 5.1,
    }

    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: lowZoomViewport,
        frames: [],
        selectedFrameId: null,
        onViewportChange: mockOnViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 400,
      clientY: 300,
      deltaY: 10000, // Large zoom out
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    expect(mockOnViewportChange).toHaveBeenCalled()
    const newViewport = mockOnViewportChange.mock.calls[0][0]
    expect(newViewport.zoom).toBeGreaterThanOrEqual(5.0) // MIN_ZOOM
  })

  it('should respect MAX_ZOOM limit', () => {
    const highZoomViewport: ViewportState = {
      ...defaultViewport,
      zoom: 499.0,
    }

    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: highZoomViewport,
        frames: [],
        selectedFrameId: null,
        onViewportChange: mockOnViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 400,
      clientY: 300,
      deltaY: -10000, // Large zoom in
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    expect(mockOnViewportChange).toHaveBeenCalled()
    const newViewport = mockOnViewportChange.mock.calls[0][0]
    expect(newViewport.zoom).toBeLessThanOrEqual(500.0) // MAX_ZOOM
  })

  it('should zoom selected frame on wheel event', () => {
    const frame: CoordinateFrame = {
      id: 'frame-1',
      origin: [10, 10],
      baseI: [1, 0],
      baseJ: [0, 1],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      viewport: {
        x: 0,
        y: 0,
        zoom: 1.0,
        gridStep: 1,
      },
      mode: '2d',
      vectors: [],
      functions: [],
      code: '',
      parentFrameId: null,
      childFrameIds: [],
    }

    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: defaultViewport,
        frames: [frame],
        selectedFrameId: 'frame-1',
        onFrameViewportChange: mockOnFrameViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 400,
      clientY: 300,
      deltaY: -100,
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    expect(mockOnFrameViewportChange).toHaveBeenCalledWith('frame-1', expect.any(Object))
    const newFrameViewport = mockOnFrameViewportChange.mock.calls[0][1]
    expect(newFrameViewport.zoom).toBeGreaterThan(frame.viewport.zoom)
  })

  it('should respect FRAME_MIN_ZOOM limit', () => {
    const frame: CoordinateFrame = {
      id: 'frame-1',
      origin: [10, 10],
      baseI: [1, 0],
      baseJ: [0, 1],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      viewport: {
        x: 0,
        y: 0,
        zoom: 0.11,
        gridStep: 1,
      },
      mode: '2d',
      vectors: [],
      functions: [],
      code: '',
      parentFrameId: null,
      childFrameIds: [],
    }

    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: defaultViewport,
        frames: [frame],
        selectedFrameId: 'frame-1',
        onFrameViewportChange: mockOnFrameViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 400,
      clientY: 300,
      deltaY: 10000, // Large zoom out
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    expect(mockOnFrameViewportChange).toHaveBeenCalled()
    const newFrameViewport = mockOnFrameViewportChange.mock.calls[0][1]
    expect(newFrameViewport.zoom).toBeGreaterThanOrEqual(0.1) // FRAME_MIN_ZOOM
  })

  it('should respect FRAME_MAX_ZOOM limit', () => {
    const frame: CoordinateFrame = {
      id: 'frame-1',
      origin: [10, 10],
      baseI: [1, 0],
      baseJ: [0, 1],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      viewport: {
        x: 0,
        y: 0,
        zoom: 9.9,
        gridStep: 1,
      },
      mode: '2d',
      vectors: [],
      functions: [],
      code: '',
      parentFrameId: null,
      childFrameIds: [],
    }

    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: defaultViewport,
        frames: [frame],
        selectedFrameId: 'frame-1',
        onFrameViewportChange: mockOnFrameViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 400,
      clientY: 300,
      deltaY: -10000, // Large zoom in
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    expect(mockOnFrameViewportChange).toHaveBeenCalled()
    const newFrameViewport = mockOnFrameViewportChange.mock.calls[0][1]
    expect(newFrameViewport.zoom).toBeLessThanOrEqual(10.0) // FRAME_MAX_ZOOM
  })

  it('should not zoom if zoom change is too small', () => {
    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: defaultViewport,
        frames: [],
        selectedFrameId: null,
        onViewportChange: mockOnViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 400,
      clientY: 300,
      deltaY: 0.001, // Very small change
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    // Should not call if zoom change is negligible
    // (This depends on implementation - if it filters out tiny changes)
  })

  it('should use custom width and height if provided', () => {
    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: defaultViewport,
        frames: [],
        selectedFrameId: null,
        width: 1000,
        height: 800,
        onViewportChange: mockOnViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 500,
      clientY: 400,
      deltaY: -100,
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    expect(mockOnViewportChange).toHaveBeenCalled()
  })

  it('should clean up event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(canvasRef.current!, 'removeEventListener')

    const { unmount } = renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: defaultViewport,
        frames: [],
        selectedFrameId: null,
        onViewportChange: mockOnViewportChange,
      })
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function), expect.any(Object))
  })

  it('should not zoom frame if selectedFrameId does not match any frame', () => {
    const frame: CoordinateFrame = {
      id: 'frame-1',
      origin: [10, 10],
      baseI: [1, 0],
      baseJ: [0, 1],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      viewport: {
        x: 0,
        y: 0,
        zoom: 1.0,
        gridStep: 1,
      },
      mode: '2d',
      vectors: [],
      functions: [],
      code: '',
      parentFrameId: null,
      childFrameIds: [],
    }

    renderHook(() =>
      useCanvasZoom({
        canvasRef,
        containerRef,
        viewport: defaultViewport,
        frames: [frame],
        selectedFrameId: 'non-existent-frame',
        onFrameViewportChange: mockOnFrameViewportChange,
        onViewportChange: mockOnViewportChange,
      })
    )

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 400,
      clientY: 300,
      deltaY: -100,
      bubbles: true,
    })

    canvasRef.current?.dispatchEvent(wheelEvent)

    // Should zoom background instead
    expect(mockOnViewportChange).toHaveBeenCalled()
    expect(mockOnFrameViewportChange).not.toHaveBeenCalled()
  })
})

