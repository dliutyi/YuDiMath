import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoadingOverlay from '../../src/components/LoadingOverlay'
import * as usePyScriptModule from '../../src/hooks/usePyScript'

// Mock the usePyScript hook
vi.mock('../../src/hooks/usePyScript', () => ({
  usePyScript: vi.fn(),
}))

describe('LoadingOverlay', () => {
  const mockUsePyScript = vi.mocked(usePyScriptModule.usePyScript)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading overlay when not ready', () => {
    mockUsePyScript.mockReturnValue({
      isReady: false,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    render(<LoadingOverlay />)

    expect(screen.getByText('YuDiMath')).toBeInTheDocument()
    expect(screen.getByText('Initializing Python runtime...')).toBeInTheDocument()
  })

  it('should display progress percentage', () => {
    mockUsePyScript.mockReturnValue({
      isReady: false,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    render(<LoadingOverlay />)

    // Progress percentage should be displayed
    const percentage = screen.getByText(/^\d+%$/)
    expect(percentage).toBeInTheDocument()
  })

  it('should display progress bar', () => {
    mockUsePyScript.mockReturnValue({
      isReady: false,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    const { container } = render(<LoadingOverlay />)
    const progressBar = container.querySelector('.bg-bg-secondary')
    expect(progressBar).toBeInTheDocument()
  })

  it('should show "Downloading Python runtime..." initially', () => {
    mockUsePyScript.mockReturnValue({
      isReady: false,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    render(<LoadingOverlay />)

    // Initially progress is 0, so should show first message
    expect(screen.getByText('Downloading Python runtime...')).toBeInTheDocument()
  })

  it('should display spinner animation', () => {
    mockUsePyScript.mockReturnValue({
      isReady: false,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    const { container } = render(<LoadingOverlay />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('should display pulsing center dot', () => {
    mockUsePyScript.mockReturnValue({
      isReady: false,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    const { container } = render(<LoadingOverlay />)
    const dot = container.querySelector('.animate-pulse')
    expect(dot).toBeInTheDocument()
  })

  it('should render progress bar with correct structure', () => {
    mockUsePyScript.mockReturnValue({
      isReady: false,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    const { container } = render(<LoadingOverlay />)
    // Find progress fill - it has bg-primary and rounded-full classes
    const progressFill = container.querySelector('[class*="bg-primary"][class*="rounded-full"]')
    // Progress fill should exist
    expect(progressFill).not.toBeNull()
    
    // Check that progress bar container exists
    const progressContainer = container.querySelector('.bg-bg-secondary')
    expect(progressContainer).not.toBeNull()
  })

  it('should render when isReady is true', () => {
    mockUsePyScript.mockReturnValue({
      isReady: true,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    render(<LoadingOverlay />)

    expect(screen.getByText('YuDiMath')).toBeInTheDocument()
  })

  it('should have correct CSS classes for overlay', () => {
    mockUsePyScript.mockReturnValue({
      isReady: false,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    const { container } = render(<LoadingOverlay />)
    const overlay = container.querySelector('.fixed.inset-0')
    expect(overlay).toBeInTheDocument()
    expect(overlay?.className).toContain('z-50')
  })
})

