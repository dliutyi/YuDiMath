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
    render(<PropertiesPanel selectedFrame={null} onFrameUpdate={mockOnFrameUpdate} />)
    
    expect(screen.getByText('No frame selected')).toBeInTheDocument()
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
    
    const baseJYInput = screen.getAllByDisplayValue('1')[1] // baseJ Y (second 1)
    fireEvent.change(baseJYInput, { target: { value: '3' } })
    
    await waitFor(() => {
      expect(mockOnFrameUpdate).toHaveBeenCalledWith('test-frame-1', {
        origin: [0, 0],
        baseI: [1, 0],
        baseJ: [0, 3],
      })
    })
  })

  it('shows error when base vectors are collinear', async () => {
    render(<PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    // Make baseI and baseJ collinear by making baseJ parallel to baseI
    // baseI is [1, 0], so baseJ should be [2, 0] to be collinear
    const inputs = screen.getAllByRole('spinbutton')
    // Inputs order: origin X, origin Y, baseI X, baseI Y, baseJ X, baseJ Y
    const baseJXInput = inputs[4] // baseJ X
    const baseJYInput = inputs[5] // baseJ Y
    
    // Set baseJ to [2, 0] which is collinear with baseI [1, 0]
    fireEvent.change(baseJXInput, { target: { value: '2' } })
    fireEvent.change(baseJYInput, { target: { value: '0' } })
    
    await waitFor(() => {
      expect(screen.getByText('Base vectors cannot be collinear (parallel)')).toBeInTheDocument()
    }, { timeout: 2000 })
    
    // Clear previous calls
    mockOnFrameUpdate.mockClear()
    
    // Verify that after error, no update is called
    expect(mockOnFrameUpdate).not.toHaveBeenCalled()
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
      expect(screen.getByText('Base vectors cannot be zero')).toBeInTheDocument()
    })
    
    expect(mockOnFrameUpdate).not.toHaveBeenCalled()
  })

  it('shows error for invalid number input', async () => {
    render(<PropertiesPanel selectedFrame={testFrame} onFrameUpdate={mockOnFrameUpdate} />)
    
    const originXInput = screen.getAllByDisplayValue('0')[0]
    fireEvent.change(originXInput, { target: { value: 'invalid' } })
    
    await waitFor(() => {
      expect(screen.getByText('All values must be valid numbers')).toBeInTheDocument()
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
    
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
  })
})

