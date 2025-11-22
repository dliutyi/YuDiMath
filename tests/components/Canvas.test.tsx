import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import Canvas from '../../src/components/Canvas'
import type { ViewportState } from '../../src/types'

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

describe('Canvas', () => {
  const defaultViewport: ViewportState = {
    x: 0,
    y: 0,
    zoom: 1.0,
    gridStep: 1,
  }

  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      scale: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1.0,
      imageSmoothingEnabled: true,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: vi.fn(),
    })

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

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders canvas element', () => {
    const { container } = render(<Canvas viewport={defaultViewport} />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('calls onViewportChange when panning', () => {
    const onViewportChange = vi.fn()
    
    const { container } = render(
      <Canvas viewport={defaultViewport} onViewportChange={onViewportChange} />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Simulate mouse down at center
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0, // Left button
      clientX: 400,
      clientY: 300,
    })
    canvas.dispatchEvent(mouseDownEvent)
    
    // Simulate mouse move (pan right and down)
    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 400,
    })
    canvas.dispatchEvent(mouseMoveEvent)
    
    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
    })
    canvas.dispatchEvent(mouseUpEvent)

    // onViewportChange should have been called
    expect(onViewportChange).toHaveBeenCalled()
    
    // Get the last call to check viewport update
    const lastCall = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1]
    const newViewport = lastCall[0] as ViewportState
    
    // Viewport should have changed (panned)
    expect(newViewport.x).not.toBe(defaultViewport.x)
    expect(newViewport.y).not.toBe(defaultViewport.y)
    expect(newViewport.zoom).toBe(defaultViewport.zoom) // Zoom should not change
  })

  it('calls onViewportChange when zooming with wheel', () => {
    const onViewportChange = vi.fn()
    
    const { container } = render(
      <Canvas viewport={defaultViewport} onViewportChange={onViewportChange} />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Simulate wheel event (zoom in)
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 400,
      clientY: 300,
      deltaY: -100, // Negative deltaY = zoom in
    })
    
    canvas.dispatchEvent(wheelEvent)

    // onViewportChange should have been called
    expect(onViewportChange).toHaveBeenCalled()
    
    // Get the last call to check viewport update
    const lastCall = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1]
    const newViewport = lastCall[0] as ViewportState
    
    // Zoom should have increased
    expect(newViewport.zoom).toBeGreaterThan(defaultViewport.zoom)
  })

  it('enforces zoom constraints', () => {
    const onViewportChange = vi.fn()
    
    // Start with minimum zoom
    const minZoomViewport: ViewportState = {
      ...defaultViewport,
      zoom: 0.1, // MIN_ZOOM
    }
    
    const { container } = render(
      <Canvas viewport={minZoomViewport} onViewportChange={onViewportChange} />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Try to zoom out further (should be constrained)
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 400,
      clientY: 300,
      deltaY: 1000, // Large positive deltaY = zoom out
    })
    
    canvas.dispatchEvent(wheelEvent)

    if (onViewportChange.mock.calls.length > 0) {
      const lastCall = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1]
      const newViewport = lastCall[0] as ViewportState
      
      // Zoom should not go below minimum
      expect(newViewport.zoom).toBeGreaterThanOrEqual(0.1)
    }
  })

  it('does not call onViewportChange when panning without handler', () => {
    const { container } = render(
      <Canvas viewport={defaultViewport} />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Simulate mouse down and move
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 400,
      clientY: 300,
    })
    canvas.dispatchEvent(mouseDownEvent)
    
    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 400,
    })
    canvas.dispatchEvent(mouseMoveEvent)
    
    // Should not throw error (no handler means no-op)
    expect(true).toBe(true)
  })

  it('handles mouse leave during panning', () => {
    const onViewportChange = vi.fn()
    
    const { container } = render(
      <Canvas viewport={defaultViewport} onViewportChange={onViewportChange} />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Start panning
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 400,
      clientY: 300,
    })
    canvas.dispatchEvent(mouseDownEvent)
    
    // Simulate mouse leave
    const mouseLeaveEvent = new MouseEvent('mouseleave', {
      bubbles: true,
      cancelable: true,
    })
    canvas.dispatchEvent(mouseLeaveEvent)
    
    // Should not throw error
    expect(true).toBe(true)
  })
})
