import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

// Mock canvas context
beforeEach(() => {
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

describe('App', () => {
  it('renders the application', () => {
    render(<App />)
    // There are multiple "YuDiMath" texts (in LoadingOverlay and header), so use getAllByText
    const yuDiMathElements = screen.getAllByText('YuDiMath')
    expect(yuDiMathElements.length).toBeGreaterThan(0)
  })

  it('renders the subtitle', () => {
    render(<App />)
    expect(screen.getByText('Linear Algebra & Calculus Visualizer')).toBeInTheDocument()
  })

  it('renders canvas component', () => {
    const { container } = render(<App />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('applies dark theme classes', () => {
    const { container } = render(<App />)
    const mainDiv = container.querySelector('.bg-bg-primary')
    expect(mainDiv).not.toBeNull()
    expect(mainDiv).toBeInstanceOf(HTMLElement)
  })

  it('renders with correct text colors', () => {
    const { container } = render(<App />)
    const textElements = container.querySelectorAll('.text-text-primary, .text-text-secondary')
    expect(textElements.length).toBeGreaterThan(0)
  })
})

