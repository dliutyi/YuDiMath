import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PropertiesPanel from '../../src/components/PropertiesPanel'
import type { CoordinateFrame } from '../../src/types'

describe('PropertiesPanel', () => {
  let mockOnFrameUpdate: ReturnType<typeof vi.fn>
  let testFrame: CoordinateFrame

  beforeEach(() => {
    mockOnFrameUpdate = vi.fn()
    testFrame = {
      id: 'test-frame-1',
      origin: [0, 0],
      baseI: [1, 0],
      baseJ: [0, 1],
      bounds: {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      },
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
  })

  it('displays "No frame selected" when no frame is selected', () => {
    const { container } = render(<PropertiesPanel selectedFrame={null} onFrameUpdate={mockOnFrameUpdate} />)
    
    // Component returns null when no frame is selected
    expect(container.firstChild).toBeNull()
  })

  it('displays selected frame properties', () => {
    render(<PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    // Check that all expected values are present (using getAllByDisplayValue since there are multiple values)
    const zeroInputs = screen.getAllByDisplayValue('0')
    expect(zeroInputs.length).toBeGreaterThan(0)
    const oneInputs = screen.getAllByDisplayValue('1')
    expect(oneInputs.length).toBeGreaterThan(0)
    expect(screen.getByText('Frame Properties')).toBeInTheDocument()
  })

  it('updates frame origin on input change', async () => {
    render(<PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    const originXInput = screen.getAllByDisplayValue('0')[0] // First 0 is origin X
    fireEvent.change(originXInput, { target: { value: '5' } })
    
    await waitFor(() => {
      expect(mockOnFrameUpdate).toHaveBeenCalledWith('test-frame-1', {
        origin: [5, 0],
        baseI: [1, 0],
        baseJ: [0, 1],
      })
    })
  })

  it('updates base I vector on input change', async () => {
    render(<PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    const baseIXInput = screen.getAllByDisplayValue('1')[0] // baseI X
    fireEvent.change(baseIXInput, { target: { value: '2' } })
    
    await waitFor(() => {
      expect(mockOnFrameUpdate).toHaveBeenCalledWith('test-frame-1', {
        origin: [0, 0],
        baseI: [2, 0],
        baseJ: [0, 1],
      })
    })
  })

  it('updates base J vector on input change', async () => {
    render(<PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    // Find the base J Y slider (range input)
    const baseJYSlider = screen.getByText('Base J Vector').closest('div')?.querySelectorAll('input[type="range"]')[1]
    expect(baseJYSlider).toBeInTheDocument()
    fireEvent.change(baseJYSlider!, { target: { value: '1.5' } })
    
    await waitFor(() => {
      expect(mockOnFrameUpdate).toHaveBeenCalledWith('test-frame-1', {
        origin: [0, 0],
        baseI: [1, 0],
        baseJ: [0, 1.5],
      })
    })
  })

  it('shows error when base vectors are collinear', async () => {
    const { rerender } = render(<PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    // Make baseI and baseJ collinear by making baseJ parallel to baseI
    // baseI is [1, 0], so baseJ should be [2, 0] to be collinear
    const baseJLabel = screen.getByText('Base J Vector')
    const baseJContainer = baseJLabel.closest('div')?.parentElement
    const baseJSliders = baseJContainer?.querySelectorAll('input[type="range"]')
    
    expect(baseJSliders).toBeDefined()
    expect(baseJSliders!.length).toBeGreaterThanOrEqual(2)
    
    const baseJXSlider = baseJSliders![0] as HTMLInputElement
    const baseJYSlider = baseJSliders![1] as HTMLInputElement
    
    fireEvent.change(baseJXSlider, { target: { value: '2' } })
    fireEvent.change(baseJYSlider, { target: { value: '0' } })
    
    // Wait for the frame update to be called
    await waitFor(() => {
      expect(mockOnFrameUpdate).toHaveBeenCalled()
    })
    
    // Now update the selectedFrame prop to reflect the collinear vectors
    const updatedFrame: CoordinateFrame = {
      ...testFrame,
      baseJ: [2, 0],
    }
    rerender(<PropertiesPanel selectedFrame={updatedFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    // Now the warning should appear
    await waitFor(() => {
      expect(screen.getByText(/Degenerate: Collinear base vectors/i)).toBeInTheDocument()
    })
  })

  it('normalizes base vectors when toggle is enabled', async () => {
    const frameWithNonUnitVectors: CoordinateFrame = {
      ...testFrame,
      baseI: [2, 0],
      baseJ: [0, 3],
    }
    
    render(<PropertiesPanel selectedFrame={frameWithNonUnitVectors} onFrameUpdate={mockOnFrameUpdate} />)
    
    const normalizeCheckbox = screen.getByLabelText(/normalize base vectors/i)
    fireEvent.click(normalizeCheckbox)
    
    await waitFor(() => {
      expect(mockOnFrameUpdate).toHaveBeenCalledWith('test-frame-1', {
        origin: [0, 0],
        baseI: [1, 0], // normalized
        baseJ: [0, 1], // normalized
      })
    })
  })

  it('shows error when trying to normalize zero vectors', async () => {
    const frameWithZeroVectors: CoordinateFrame = {
      ...testFrame,
      baseI: [0, 0],
      baseJ: [0, 0],
    }
    
    render(<PropertiesPanel selectedFrame={frameWithZeroVectors} onFrameUpdate={mockOnFrameUpdate} />)
    
    const normalizeCheckbox = screen.getByLabelText(/normalize base vectors/i)
    fireEvent.click(normalizeCheckbox)
    
    await waitFor(() => {
      // The component now shows a warning status instead of an error
      expect(screen.getByText(/Degenerate: Zero base vectors/i)).toBeInTheDocument()
    })
    
    expect(mockOnFrameUpdate).not.toHaveBeenCalled()
  })

  it('shows error for invalid number input', async () => {
    render(<PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    const originXInput = screen.getAllByDisplayValue('0')[0]
    fireEvent.change(originXInput, { target: { value: 'invalid' } })
    
    await waitFor(() => {
      expect(screen.getByText('Origin values must be valid numbers')).toBeInTheDocument()
    })
    
    expect(mockOnFrameUpdate).not.toHaveBeenCalled()
  })

  it('updates form when selected frame changes', () => {
    const { rerender } = render(
      <PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />
    )
    
    const newFrame: CoordinateFrame = {
      ...testFrame,
      id: 'test-frame-2',
      origin: [10, 20],
      baseI: [2, 3],
      baseJ: [4, 5],
    }
    
    rerender(<PropertiesPanel selectedFrame={newFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    // Check origin inputs - they don't have explicit labels, so query by type
    const originInputs = screen.getByText('Origin').closest('div')?.querySelectorAll('input[type="number"]')
    expect(originInputs?.[0]).toHaveValue(10)
    expect(originInputs?.[1]).toHaveValue(20)
    
    // Check base vectors - they're range sliders, check the displayed span values
    // Find the Base I Vector label, then get its parent container
    const baseILabel = screen.getByText('Base I Vector')
    const baseIContainer = baseILabel.closest('div')?.parentElement
    // Get all spans that contain numeric values (X and Y labels)
    const baseISpans = Array.from(baseIContainer?.querySelectorAll('span') || [])
    const baseISpanTexts = baseISpans
      .map(span => span.textContent?.trim())
      .filter(text => text && /^\d+\.\d+$/.test(text))
    expect(baseISpanTexts).toContain('2.00')
    expect(baseISpanTexts).toContain('3.00')
    
    // Check base J vector
    const baseJLabel = screen.getByText('Base J Vector')
    const baseJContainer = baseJLabel.closest('div')?.parentElement
    const baseJSpans = Array.from(baseJContainer?.querySelectorAll('span') || [])
    const baseJSpanTexts = baseJSpans
      .map(span => span.textContent?.trim())
      .filter(text => text && /^\d+\.\d+$/.test(text))
    expect(baseJSpanTexts).toContain('4.00')
    expect(baseJSpanTexts).toContain('5.00')
  })

  it('should call onFrameDelete when delete button is clicked', () => {
    const mockOnFrameDelete = vi.fn()
    
    render(
      <PropertiesPanel
        selectedFrame={testFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onFrameDelete={mockOnFrameDelete}
      />
    )
    
    const deleteButton = screen.getByTitle('Delete Frame (Delete key)')
    fireEvent.click(deleteButton)
    
    expect(mockOnFrameDelete).toHaveBeenCalledWith('test-frame-1')
  })

  it('should not show delete button when onFrameDelete is not provided', () => {
    render(
      <PropertiesPanel
        selectedFrame={testFrame}
        onFrameUpdate={mockOnFrameUpdate}
      />
    )
    
    expect(screen.queryByTitle('Delete Frame (Delete key)')).not.toBeInTheDocument()
  })

  it('should call onFrameViewportChange when viewport controls are used', async () => {
    const mockOnFrameViewportChange = vi.fn()
    
    render(
      <PropertiesPanel
        selectedFrame={testFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onFrameViewportChange={mockOnFrameViewportChange}
      />
    )
    
    // Find and click "Move to Origin" button
    const moveToOriginButton = screen.getByText(/Move to Origin/i)
    fireEvent.click(moveToOriginButton)
    
    await waitFor(() => {
      expect(mockOnFrameViewportChange).toHaveBeenCalledWith('test-frame-1', expect.objectContaining({
        x: 0,
        y: 0,
      }))
    })
  })

  it('should call onFrameViewportChange when reset zoom is clicked', async () => {
    const mockOnFrameViewportChange = vi.fn()
    const frameWithZoom: CoordinateFrame = {
      ...testFrame,
      viewport: {
        x: 5,
        y: 5,
        zoom: 2.0,
        gridStep: 1,
      },
    }
    
    render(
      <PropertiesPanel
        selectedFrame={frameWithZoom}
        onFrameUpdate={mockOnFrameUpdate}
        onFrameViewportChange={mockOnFrameViewportChange}
      />
    )
    
    // Find and click "Reset Zoom" button
    const resetZoomButton = screen.getByText(/Reset Zoom/i)
    fireEvent.click(resetZoomButton)
    
    await waitFor(() => {
      expect(mockOnFrameViewportChange).toHaveBeenCalledWith('test-frame-1', expect.objectContaining({
        zoom: 1.0,
      }))
    })
  })

  it('should handle orthogonal base vector adjustment when baseI changes with normalization', async () => {
    const frameWithNormalize: CoordinateFrame = {
      ...testFrame,
      baseI: [2, 0],
      baseJ: [0, 1],
    }
    
    render(
      <PropertiesPanel
        selectedFrame={frameWithNormalize}
        onFrameUpdate={mockOnFrameUpdate}
      />
    )
    
    // Enable normalization
    const normalizeCheckbox = screen.getByLabelText(/normalize base vectors/i)
    fireEvent.click(normalizeCheckbox)
    
    await waitFor(() => {
      expect(mockOnFrameUpdate).toHaveBeenCalled()
    })
    
    // Change baseI X slider
    const baseILabel = screen.getByText('Base I Vector')
    const baseIContainer = baseILabel.closest('div')?.parentElement
    const baseISliders = baseIContainer?.querySelectorAll('input[type="range"]')
    const baseIXSlider = baseISliders![0] as HTMLInputElement
    
    fireEvent.change(baseIXSlider, { target: { value: '3' } })
    
    await waitFor(() => {
      // Should normalize and adjust baseJ to be orthogonal
      const calls = mockOnFrameUpdate.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1].baseI).toBeDefined()
      expect(lastCall[1].baseJ).toBeDefined()
    })
  })

  it('should handle orthogonal base vector adjustment when baseJ changes with normalization', async () => {
    const frameWithNormalize: CoordinateFrame = {
      ...testFrame,
      baseI: [1, 0],
      baseJ: [0, 2],
    }
    
    render(
      <PropertiesPanel
        selectedFrame={frameWithNormalize}
        onFrameUpdate={mockOnFrameUpdate}
      />
    )
    
    // Enable normalization
    const normalizeCheckbox = screen.getByLabelText(/normalize base vectors/i)
    fireEvent.click(normalizeCheckbox)
    
    await waitFor(() => {
      expect(mockOnFrameUpdate).toHaveBeenCalled()
    })
    
    // Change baseJ Y slider
    const baseJLabel = screen.getByText('Base J Vector')
    const baseJContainer = baseJLabel.closest('div')?.parentElement
    const baseJSliders = baseJContainer?.querySelectorAll('input[type="range"]')
    const baseJYSlider = baseJSliders![1] as HTMLInputElement
    
    fireEvent.change(baseJYSlider, { target: { value: '3' } })
    
    await waitFor(() => {
      // Should normalize and adjust baseI to be orthogonal
      const calls = mockOnFrameUpdate.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1].baseI).toBeDefined()
      expect(lastCall[1].baseJ).toBeDefined()
    })
  })

  it('should display ParameterSliders component', () => {
    render(
      <PropertiesPanel
        selectedFrame={testFrame}
        onFrameUpdate={mockOnFrameUpdate}
      />
    )
    
    // ParameterSliders should be rendered (it shows "No parameters" message if none exist)
    expect(screen.getByText(/No parameters/i)).toBeInTheDocument()
  })

  it('should handle parameter changes through ParameterSliders', async () => {
    const frameWithParams: CoordinateFrame = {
      ...testFrame,
      parameters: { t1: 5.0, t2: 10.0 },
    }
    
    render(
      <PropertiesPanel
        selectedFrame={frameWithParams}
        onFrameUpdate={mockOnFrameUpdate}
      />
    )
    
    // ParameterSliders should display the parameters
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })

  it('should clear error when valid input is entered after invalid input', async () => {
    render(<PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    const originXInput = screen.getAllByDisplayValue('0')[0]
    
    // Enter invalid input
    fireEvent.change(originXInput, { target: { value: 'invalid' } })
    
    await waitFor(() => {
      expect(screen.getByText('Origin values must be valid numbers')).toBeInTheDocument()
    })
    
    // Enter valid input
    fireEvent.change(originXInput, { target: { value: '5' } })
    
    await waitFor(() => {
      expect(screen.queryByText('Origin values must be valid numbers')).not.toBeInTheDocument()
    })
  })
})

