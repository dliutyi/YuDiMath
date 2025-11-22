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
    
    // Test minimum value (0 should map to 0.25, the smallest valid 0.25 increment)
    fireEvent.change(slider, { target: { value: '0' } })
    expect(onGridStepChange).toHaveBeenCalled()
    const minCall = onGridStepChange.mock.calls[onGridStepChange.mock.calls.length - 1]
    expect(minCall[0]).toBe(0.25) // Rounded to nearest 0.25 increment
    
    // Test maximum value (100 should map to 20)
    vi.clearAllMocks()
    fireEvent.change(slider, { target: { value: '100' } })
    expect(onGridStepChange).toHaveBeenCalled()
    const maxCall = onGridStepChange.mock.calls[onGridStepChange.mock.calls.length - 1]
    expect(maxCall[0]).toBeCloseTo(20, 0)
  })

  it('handles linear scale conversion and rounds to 0.25 increments', () => {
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    const slider = screen.getByRole('slider') as HTMLInputElement
    
    // Test middle value (50 should map to approximately 10, rounded to 0.25)
    // Linear: 0.25 + (50/100) * (20 - 0.25) = 0.25 + 0.5 * 19.75 = 0.25 + 9.875 = 10.125 ≈ 10.25
    fireEvent.change(slider, { target: { value: '50' } })
    expect(onGridStepChange).toHaveBeenCalled()
    const middleCall = onGridStepChange.mock.calls[onGridStepChange.mock.calls.length - 1]
    // Middle of linear scale should be around 10, rounded to 0.25
    expect(middleCall[0]).toBeGreaterThan(9)
    expect(middleCall[0]).toBeLessThan(11)
    // Value should be a multiple of 0.25
    expect(middleCall[0] % 0.25).toBeCloseTo(0, 5)
  })

  it('always rounds grid step values to 0.25 increments', () => {
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    const slider = screen.getByRole('slider') as HTMLInputElement
    
    // Test various slider positions to ensure all values are rounded to 0.25
    const testPositions = [0, 25, 50, 75, 100]
    testPositions.forEach((position) => {
      vi.clearAllMocks()
      fireEvent.change(slider, { target: { value: position.toString() } })
      if (onGridStepChange.mock.calls.length > 0) {
        const value = onGridStepChange.mock.calls[onGridStepChange.mock.calls.length - 1][0]
        // Value should be a multiple of 0.25 (within floating point precision)
        expect(value % 0.25).toBeCloseTo(0, 5)
      }
    })
  })
})
