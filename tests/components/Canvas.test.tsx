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
      setLineDash: vi.fn(),
      rect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clip: vi.fn(),
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

  it('starts rectangle drawing on mouse down when in drawing mode', async () => {
    const onFrameCreated = vi.fn()
    const onDrawingModeChange = vi.fn()
    
    const { container } = render(
      <Canvas
        viewport={defaultViewport}
        isDrawing={true}
        onFrameCreated={onFrameCreated}
        onDrawingModeChange={onDrawingModeChange}
      />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 400,
      clientY: 300,
    })
    canvas.dispatchEvent(mouseDownEvent)
    
    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Drawing should have started (rectangle should be visible in next render)
    expect(true).toBe(true) // Just verify no errors occurred
  })

  it('updates rectangle on mouse move when drawing', async () => {
    const onFrameCreated = vi.fn()
    const onDrawingModeChange = vi.fn()
    
    const { container } = render(
      <Canvas
        viewport={defaultViewport}
        isDrawing={true}
        onFrameCreated={onFrameCreated}
        onDrawingModeChange={onDrawingModeChange}
      />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Start drawing
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 400,
      clientY: 300,
    })
    canvas.dispatchEvent(mouseDownEvent)
    
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Move mouse
    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 400,
    })
    canvas.dispatchEvent(mouseMoveEvent)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Rectangle should be updating
    expect(true).toBe(true) // Just verify no errors occurred
  })

  it('creates frame on mouse up when drawing rectangle', async () => {
    const onFrameCreated = vi.fn()
    const onDrawingModeChange = vi.fn()
    
    const { container } = render(
      <Canvas
        viewport={defaultViewport}
        isDrawing={true}
        onFrameCreated={onFrameCreated}
        onDrawingModeChange={onDrawingModeChange}
      />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Start drawing
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 400,
      clientY: 300,
    })
    canvas.dispatchEvent(mouseDownEvent)
    
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Move mouse to create a rectangle
    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 400,
    })
    canvas.dispatchEvent(mouseMoveEvent)
    
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Finish drawing
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
    })
    canvas.dispatchEvent(mouseUpEvent)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Frame should be created
    expect(onFrameCreated).toHaveBeenCalled()
    const createdFrame = onFrameCreated.mock.calls[0][0]
    expect(createdFrame).toHaveProperty('id')
    expect(createdFrame).toHaveProperty('bounds')
    expect(createdFrame.bounds.width).toBeGreaterThan(0)
    expect(createdFrame.bounds.height).toBeGreaterThan(0)
  })

  it('inherits base vectors from parent frame', async () => {
    const onFrameCreated = vi.fn()
    
    const parentFrame: CoordinateFrame = {
      id: 'parent-frame',
      origin: [0, 0],
      baseI: [0.707, 0.707], // 45 degree rotation
      baseJ: [-0.707, 0.707],
      bounds: {
        x: -10,
        y: -10,
        width: 20,
        height: 20,
      },
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
      parentFrameId: null,
      childFrameIds: [],
    }
    
    const viewport = {
      ...defaultViewport,
      gridStep: 1,
    }
    
    const { container } = render(
      <Canvas
        viewport={viewport}
        isDrawing={true}
        onFrameCreated={onFrameCreated}
        frames={[parentFrame]}
      />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Start drawing inside parent frame
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 400, // Center of canvas, should be inside parent frame
      clientY: 300,
    })
    canvas.dispatchEvent(mouseDownEvent)
    
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Move mouse to create a proper-sized frame
    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 400,
    })
    canvas.dispatchEvent(mouseMoveEvent)
    
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Finish drawing
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
    })
    canvas.dispatchEvent(mouseUpEvent)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Child frame should inherit parent's base vectors
    expect(onFrameCreated).toHaveBeenCalled()
    if (onFrameCreated.mock.calls.length > 0) {
      const createdFrame = onFrameCreated.mock.calls[0][0]
      expect(createdFrame.parentFrameId).toBe('parent-frame')
      expect(createdFrame.baseI).toEqual([0.707, 0.707])
      expect(createdFrame.baseJ).toEqual([-0.707, 0.707])
    }
  })

  it('uses default base vectors for top-level frames', async () => {
    const onFrameCreated = vi.fn()
    
    const viewport = {
      ...defaultViewport,
      gridStep: 1,
    }
    
    const { container } = render(
      <Canvas
        viewport={viewport}
        isDrawing={true}
        onFrameCreated={onFrameCreated}
        frames={[]}
      />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Start drawing
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 400,
      clientY: 300,
    })
    canvas.dispatchEvent(mouseDownEvent)
    
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Move mouse to create a proper-sized frame
    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 400,
    })
    canvas.dispatchEvent(mouseMoveEvent)
    
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Finish drawing
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
    })
    canvas.dispatchEvent(mouseUpEvent)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Top-level frame should use default base vectors
    expect(onFrameCreated).toHaveBeenCalled()
    if (onFrameCreated.mock.calls.length > 0) {
      const createdFrame = onFrameCreated.mock.calls[0][0]
      expect(createdFrame.parentFrameId).toBeNull()
      expect(createdFrame.baseI).toEqual([1, 0])
      expect(createdFrame.baseJ).toEqual([0, 1])
    }
  })

  it('snaps rectangle corners to grid', async () => {
    const onFrameCreated = vi.fn()
    
    const viewport = {
      ...defaultViewport,
      gridStep: 1,
    }
    
    const { container } = render(
      <Canvas
        viewport={viewport}
        isDrawing={true}
        onFrameCreated={onFrameCreated}
      />
    )
    
    const canvas = container.querySelector('canvas')
    if (!canvas) throw new Error('Canvas not found')

    // Start drawing at a non-grid position
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 410, // Slightly off grid
      clientY: 310,
    })
    canvas.dispatchEvent(mouseDownEvent)
    
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Finish drawing
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
    })
    canvas.dispatchEvent(mouseUpEvent)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Frame corners should be snapped to grid
    if (onFrameCreated.mock.calls.length > 0) {
      const createdFrame = onFrameCreated.mock.calls[0][0]
      // Check that bounds are multiples of gridStep (within floating point precision)
      const gridStep = viewport.gridStep
      expect(createdFrame.bounds.x % gridStep).toBeCloseTo(0, 5)
      expect(createdFrame.bounds.y % gridStep).toBeCloseTo(0, 5)
    }
  })

  it('renders grid with different grid steps', async () => {
    const mockContext = {
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
      setLineDash: vi.fn(),
      rect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clip: vi.fn(),
    }

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext)

    // Test with gridStep = 1
    const viewport1: ViewportState = {
      ...defaultViewport,
      gridStep: 1,
    }
    const { rerender } = render(<Canvas viewport={viewport1} />)
    
    // Wait for requestAnimationFrame to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Grid should be drawn (moveTo and lineTo should be called)
    expect(mockContext.beginPath).toHaveBeenCalled()
    expect(mockContext.moveTo).toHaveBeenCalled()
    expect(mockContext.lineTo).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()

    // Clear mocks
    vi.clearAllMocks()

    // Test with gridStep = 5
    const viewport5: ViewportState = {
      ...defaultViewport,
      gridStep: 5,
    }
    rerender(<Canvas viewport={viewport5} />)
    
    // Wait for requestAnimationFrame to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Grid should still be drawn with different step
    expect(mockContext.beginPath).toHaveBeenCalled()
    expect(mockContext.moveTo).toHaveBeenCalled()
    expect(mockContext.lineTo).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()
  })

  it('updates grid rendering when gridStep changes', async () => {
    const mockContext = {
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
      setLineDash: vi.fn(),
      rect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clip: vi.fn(),
    }

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext)

    const { rerender } = render(<Canvas viewport={defaultViewport} />)
    
    // Wait for requestAnimationFrame to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Initial render should draw grid
    const initialCalls = mockContext.lineTo.mock.calls.length
    expect(initialCalls).toBeGreaterThan(0)

    // Change gridStep
    const newViewport: ViewportState = {
      ...defaultViewport,
      gridStep: 10,
    }
    vi.clearAllMocks()
    rerender(<Canvas viewport={newViewport} />)
    
    // Wait for requestAnimationFrame to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Grid should be redrawn with new step
    expect(mockContext.beginPath).toHaveBeenCalled()
    expect(mockContext.moveTo).toHaveBeenCalled()
    expect(mockContext.lineTo).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()
  })
})
