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
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders canvas element', () => {
    const { container } = render(<Canvas viewport={defaultViewport} />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders with container div', () => {
    const { container } = render(<Canvas viewport={defaultViewport} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toBeInTheDocument()
    expect(wrapper.tagName).toBe('DIV')
  })

  it('applies correct CSS classes', () => {
    const { container } = render(<Canvas viewport={defaultViewport} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('bg-bg-primary')
  })

  it('calls getContext on canvas', () => {
    render(<Canvas viewport={defaultViewport} />)
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d')
  })

  it('handles viewport changes', () => {
    const { rerender } = render(<Canvas viewport={defaultViewport} />)
    
    const newViewport: ViewportState = {
      x: 10,
      y: 20,
      zoom: 2.0,
      gridStep: 1,
    }
    
    rerender(<Canvas viewport={newViewport} />)
    // Component should re-render with new viewport
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled()
  })

  it('handles custom width and height', () => {
    render(<Canvas viewport={defaultViewport} width={1920} height={1080} />)
    // Component should accept custom dimensions
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled()
  })

  it('sets up ResizeObserver', () => {
    render(<Canvas viewport={defaultViewport} />)
    expect(global.ResizeObserver).toHaveBeenCalled()
  })
})

