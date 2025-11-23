import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Toolbar from '../../src/components/Toolbar'

describe('Toolbar', () => {
  const defaultProps = {
    gridStep: 1.0,
    onGridStepChange: vi.fn(),
    zoom: 50.0,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onClear: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all controls', () => {
    render(<Toolbar {...defaultProps} />)
    
    // Grid step selector should be present
    expect(screen.getByText(/Grid Step:/i)).toBeInTheDocument()
    
    // Zoom controls should be present
    expect(screen.getByText(/Zoom:/i)).toBeInTheDocument()
    expect(screen.getByTitle('Zoom In')).toBeInTheDocument()
    expect(screen.getByTitle('Zoom Out')).toBeInTheDocument()
    expect(screen.getByTitle('Reset Zoom')).toBeInTheDocument()
    
    // Workspace controls should be present
    expect(screen.getByTitle('Export Workspace')).toBeInTheDocument()
    expect(screen.getByTitle('Import Workspace')).toBeInTheDocument()
    expect(screen.getByTitle('Clear Workspace')).toBeInTheDocument()
  })

  it('displays current grid step value', () => {
    render(<Toolbar {...defaultProps} gridStep={2.5} />)
    expect(screen.getByText('2.50')).toBeInTheDocument()
  })

  it('displays current zoom value', () => {
    render(<Toolbar {...defaultProps} zoom={75.5} />)
    expect(screen.getByText('75.5x')).toBeInTheDocument()
  })

  it('calls onGridStepChange when grid step slider changes', () => {
    render(<Toolbar {...defaultProps} />)
    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
    
    fireEvent.change(slider, { target: { value: '50' } })
    expect(defaultProps.onGridStepChange).toHaveBeenCalled()
  })

  it('calls onZoomIn when zoom in button is clicked', () => {
    render(<Toolbar {...defaultProps} />)
    const zoomInButton = screen.getByTitle('Zoom In')
    fireEvent.click(zoomInButton)
    expect(defaultProps.onZoomIn).toHaveBeenCalledTimes(1)
  })

  it('calls onZoomOut when zoom out button is clicked', () => {
    render(<Toolbar {...defaultProps} />)
    const zoomOutButton = screen.getByTitle('Zoom Out')
    fireEvent.click(zoomOutButton)
    expect(defaultProps.onZoomOut).toHaveBeenCalledTimes(1)
  })

  it('calls onZoomReset when reset zoom button is clicked', () => {
    render(<Toolbar {...defaultProps} />)
    const resetButton = screen.getByTitle('Reset Zoom')
    fireEvent.click(resetButton)
    expect(defaultProps.onZoomReset).toHaveBeenCalledTimes(1)
  })

  it('disables zoom in button when zoom is at maximum', () => {
    render(<Toolbar {...defaultProps} zoom={500.0} />)
    const zoomInButton = screen.getByTitle('Zoom In')
    expect(zoomInButton).toBeDisabled()
  })

  it('disables zoom out button when zoom is at minimum', () => {
    render(<Toolbar {...defaultProps} zoom={5.0} />)
    const zoomOutButton = screen.getByTitle('Zoom Out')
    expect(zoomOutButton).toBeDisabled()
  })

  it('calls onExport when export button is clicked', () => {
    render(<Toolbar {...defaultProps} />)
    const exportButton = screen.getByTitle('Export Workspace')
    fireEvent.click(exportButton)
    expect(defaultProps.onExport).toHaveBeenCalledTimes(1)
  })

  it('calls onImport when import button is clicked', () => {
    render(<Toolbar {...defaultProps} />)
    const importButton = screen.getByTitle('Import Workspace')
    fireEvent.click(importButton)
    expect(defaultProps.onImport).toHaveBeenCalledTimes(1)
  })

  it('calls onClear when clear button is clicked', () => {
    render(<Toolbar {...defaultProps} />)
    const clearButton = screen.getByTitle('Clear Workspace')
    fireEvent.click(clearButton)
    expect(defaultProps.onClear).toHaveBeenCalledTimes(1)
  })

  it('formats zoom value correctly', () => {
    const { rerender } = render(<Toolbar {...defaultProps} zoom={50.0} />)
    expect(screen.getByText('50.0x')).toBeInTheDocument()
    
    rerender(<Toolbar {...defaultProps} zoom={123.456} />)
    expect(screen.getByText('123.5x')).toBeInTheDocument()
  })
})

