import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GridStepSelector from '../../src/components/GridStepSelector'

describe('GridStepSelector', () => {
  it('renders slider and label', () => {
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    expect(screen.getByText('Grid Step:')).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('displays current grid step value', () => {
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    expect(screen.getByText('1.0')).toBeInTheDocument()
  })

  it('displays formatted grid step value correctly', () => {
    const onGridStepChange = vi.fn()
    const { rerender } = render(
      <GridStepSelector gridStep={0.5} onGridStepChange={onGridStepChange} />
    )
    
    expect(screen.getByText('0.50')).toBeInTheDocument()
    
    rerender(<GridStepSelector gridStep={5} onGridStepChange={onGridStepChange} />)
    expect(screen.getByText('5.0')).toBeInTheDocument()
    
    rerender(<GridStepSelector gridStep={15} onGridStepChange={onGridStepChange} />)
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('calls onGridStepChange when slider is moved', () => {
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    const slider = screen.getByRole('slider') as HTMLInputElement
    // Move slider to approximately 50% (should give a value around 1-2)
    fireEvent.change(slider, { target: { value: '50' } })
    
    expect(onGridStepChange).toHaveBeenCalled()
    const lastCall = onGridStepChange.mock.calls[onGridStepChange.mock.calls.length - 1]
    expect(lastCall[0]).toBeGreaterThan(0.1)
    expect(lastCall[0]).toBeLessThanOrEqual(20)
  })

  it('updates displayed value when gridStep prop changes', () => {
    const onGridStepChange = vi.fn()
    const { rerender } = render(
      <GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />
    )
    
    expect(screen.getByText('1.0')).toBeInTheDocument()
    
    rerender(<GridStepSelector gridStep={2.5} onGridStepChange={onGridStepChange} />)
    expect(screen.getByText('2.5')).toBeInTheDocument()
    
    rerender(<GridStepSelector gridStep={10} onGridStepChange={onGridStepChange} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('converts slider value to grid step correctly', () => {
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    const slider = screen.getByRole('slider') as HTMLInputElement
    
    // Test minimum value (0 should map to 0.1)
    fireEvent.change(slider, { target: { value: '0' } })
    expect(onGridStepChange).toHaveBeenCalled()
    const minCall = onGridStepChange.mock.calls[onGridStepChange.mock.calls.length - 1]
    expect(minCall[0]).toBeCloseTo(0.1, 1)
    
    // Test maximum value (100 should map to 20)
    vi.clearAllMocks()
    fireEvent.change(slider, { target: { value: '100' } })
    expect(onGridStepChange).toHaveBeenCalled()
    const maxCall = onGridStepChange.mock.calls[onGridStepChange.mock.calls.length - 1]
    expect(maxCall[0]).toBeCloseTo(20, 0)
  })

  it('handles logarithmic scale conversion', () => {
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    const slider = screen.getByRole('slider') as HTMLInputElement
    
    // Test middle value (50 should map to approximately 1)
    fireEvent.change(slider, { target: { value: '50' } })
    expect(onGridStepChange).toHaveBeenCalled()
    const middleCall = onGridStepChange.mock.calls[onGridStepChange.mock.calls.length - 1]
    // Middle of log scale should be around 1-2
    expect(middleCall[0]).toBeGreaterThan(0.5)
    expect(middleCall[0]).toBeLessThan(3)
  })
})
