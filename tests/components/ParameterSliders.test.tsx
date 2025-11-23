import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ParameterSliders from '../../src/components/ParameterSliders'
import type { CoordinateFrame } from '../../src/types'

describe('ParameterSliders', () => {
  const mockFrame: CoordinateFrame = {
    id: 'test-frame-1',
    origin: [5, 10],
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

  const mockOnParameterChange = vi.fn()

  beforeEach(() => {
    mockOnParameterChange.mockClear()
  })

  it('should render nothing when no frame is selected', () => {
    const { container } = render(
      <ParameterSliders
        selectedFrame={null}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('should display message when no parameters exist', () => {
    render(
      <ParameterSliders
        selectedFrame={mockFrame}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    expect(screen.getByText(/No parameters/i)).toBeInTheDocument()
    expect(screen.getByText(/Click "\+ Add" to create one/i)).toBeInTheDocument()
  })

  it('should display existing parameters', () => {
    const frameWithParams = {
      ...mockFrame,
      parameters: {
        t1: 5.0,
        t2: -3.5,
      },
    }
    
    render(
      <ParameterSliders
        selectedFrame={frameWithParams}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    expect(screen.getByText('t1')).toBeInTheDocument()
    expect(screen.getByText('t2')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('-3.5')).toBeInTheDocument()
  })

  it('should call onParameterChange when adding a slider', () => {
    render(
      <ParameterSliders
        selectedFrame={mockFrame}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    const addButton = screen.getByText('+ Add')
    fireEvent.click(addButton)
    
    expect(mockOnParameterChange).toHaveBeenCalledWith('test-frame-1', { t1: 0 })
  })

  it('should call onParameterChange when slider value changes', () => {
    const frameWithParams = {
      ...mockFrame,
      parameters: {
        t1: 5.0,
      },
    }
    
    render(
      <ParameterSliders
        selectedFrame={frameWithParams}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    const slider = screen.getByDisplayValue('5')
    fireEvent.change(slider, { target: { value: '7.5' } })
    
    expect(mockOnParameterChange).toHaveBeenCalledWith('test-frame-1', { t1: 7.5 })
  })

  it('should call onParameterChange when removing a slider', () => {
    const frameWithParams = {
      ...mockFrame,
      parameters: {
        t1: 5.0,
        t2: -3.5,
      },
    }
    
    render(
      <ParameterSliders
        selectedFrame={frameWithParams}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    const removeButtons = screen.getAllByText('×')
    fireEvent.click(removeButtons[0]) // Remove t1
    
    expect(mockOnParameterChange).toHaveBeenCalledWith('test-frame-1', { t2: -3.5 })
  })

  it('should generate correct parameter names (t1, t2, t3)', () => {
    const { rerender } = render(
      <ParameterSliders
        selectedFrame={mockFrame}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    // Add first parameter
    fireEvent.click(screen.getByText('+ Add'))
    expect(mockOnParameterChange).toHaveBeenCalledWith('test-frame-1', { t1: 0 })
    
    // Update frame with t1
    const frameWithT1 = {
      ...mockFrame,
      parameters: { t1: 0 },
    }
    
    rerender(
      <ParameterSliders
        selectedFrame={frameWithT1}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    // Add second parameter
    fireEvent.click(screen.getByText('+ Add'))
    expect(mockOnParameterChange).toHaveBeenLastCalledWith('test-frame-1', { t1: 0, t2: 0 })
  })

  it('should sort parameters correctly (t1, t2, t3)', () => {
    const frameWithParams = {
      ...mockFrame,
      parameters: {
        t3: 10,
        t1: 5.0,
        t2: -3.5,
      },
    }
    
    render(
      <ParameterSliders
        selectedFrame={frameWithParams}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    const labels = screen.getAllByText(/^t\d+$/)
    expect(labels[0]).toHaveTextContent('t1')
    expect(labels[1]).toHaveTextContent('t2')
    expect(labels[2]).toHaveTextContent('t3')
  })

  it('should update when selected frame changes', () => {
    const { rerender } = render(
      <ParameterSliders
        selectedFrame={mockFrame}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    const frameWithParams = {
      ...mockFrame,
      id: 'test-frame-2',
      parameters: {
        t1: 7.5,
      },
    }
    
    rerender(
      <ParameterSliders
        selectedFrame={frameWithParams}
        onParameterChange={mockOnParameterChange}
      />
    )
    
    expect(screen.getByText('t1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('7.5')).toBeInTheDocument()
  })
})

