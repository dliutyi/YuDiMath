import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GridStepSelector from '../../src/components/GridStepSelector'

describe('GridStepSelector', () => {
  it('renders all preset buttons', () => {
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    expect(screen.getByText('0.5')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('calls onGridStepChange when preset is clicked', async () => {
    const user = userEvent.setup()
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    const presetButton = screen.getByText('2')
    await user.click(presetButton)
    
    expect(onGridStepChange).toHaveBeenCalledWith(2)
  })

  it('highlights active preset button', () => {
    const onGridStepChange = vi.fn()
    const { rerender } = render(
      <GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />
    )
    
    const presetButton = screen.getByText('1')
    expect(presetButton).toHaveClass('bg-accent')
    
    rerender(<GridStepSelector gridStep={2} onGridStepChange={onGridStepChange} />)
    const newPresetButton = screen.getByText('2')
    expect(newPresetButton).toHaveClass('bg-accent')
  })

  it('allows custom grid step input', async () => {
    const user = userEvent.setup()
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    const customInput = screen.getByPlaceholderText('Custom') as HTMLInputElement
    // Focus to enter custom mode, then select all and replace
    await user.click(customInput)
    await user.clear(customInput)
    await user.type(customInput, '3.5')
    
    // Check that the final value (3.5) was called (check last call)
    const calls = onGridStepChange.mock.calls
    expect(calls[calls.length - 1][0]).toBe(3.5)
  })

  it('validates custom input and resets on invalid value', async () => {
    const user = userEvent.setup()
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    const customInput = screen.getByPlaceholderText('Custom') as HTMLInputElement
    await user.click(customInput)
    await user.clear(customInput)
    await user.type(customInput, 'abc')
    await user.tab() // Trigger blur
    
    // Should reset to default (1) on blur when value is invalid
    expect(onGridStepChange).toHaveBeenCalledWith(1)
    expect(customInput.value).toBe('')
  })

  it('rejects negative or zero values', async () => {
    const user = userEvent.setup()
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />)
    
    const customInput = screen.getByPlaceholderText('Custom') as HTMLInputElement
    await user.click(customInput)
    await user.type(customInput, '-5')
    await user.tab() // Trigger blur
    
    // Should reset to default (1)
    expect(onGridStepChange).toHaveBeenCalledWith(1)
  })

  it('shows custom value when gridStep is not a preset', () => {
    const onGridStepChange = vi.fn()
    render(<GridStepSelector gridStep={3.5} onGridStepChange={onGridStepChange} />)
    
    const customInput = screen.getByPlaceholderText('Custom') as HTMLInputElement
    expect(customInput.value).toBe('3.5')
  })

  it('updates custom value when gridStep prop changes', () => {
    const onGridStepChange = vi.fn()
    const { rerender } = render(
      <GridStepSelector gridStep={1} onGridStepChange={onGridStepChange} />
    )
    
    rerender(<GridStepSelector gridStep={7.5} onGridStepChange={onGridStepChange} />)
    
    const customInput = screen.getByPlaceholderText('Custom') as HTMLInputElement
    expect(customInput.value).toBe('7.5')
  })
})
