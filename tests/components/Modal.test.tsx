import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from '../../src/components/Modal'

describe('Modal', () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()
  const mockOnCancel = vi.fn()
  const mockOnSecondary = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <Modal
        isOpen={false}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('should render when isOpen is true', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('should display custom confirm text', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        confirmText="Custom Confirm"
        onConfirm={mockOnConfirm}
      />
    )
    
    expect(screen.getByText('Custom Confirm')).toBeInTheDocument()
  })

  it('should display custom cancel text', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        cancelText="Custom Cancel"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )
    
    expect(screen.getByText('Custom Cancel')).toBeInTheDocument()
  })

  it('should call onConfirm when confirm button is clicked', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    const confirmButton = screen.getByText('OK')
    fireEvent.click(confirmButton)
    
    expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(mockOnCancel).toHaveBeenCalledTimes(1)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onSecondary when secondary button is clicked', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
        secondaryText="Merge"
        onSecondary={mockOnSecondary}
      />
    )
    
    const secondaryButton = screen.getByText('Merge')
    fireEvent.click(secondaryButton)
    
    expect(mockOnSecondary).toHaveBeenCalledTimes(1)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should not show cancel button when onCancel is not provided', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })

  it('should not show secondary button when onSecondary is not provided', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    expect(screen.queryByText('Merge')).not.toBeInTheDocument()
  })

  it('should close when backdrop is clicked', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    const backdrop = screen.getByText('Test Modal').closest('.fixed')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    }
  })

  it('should not close when modal content is clicked', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    const modalContent = screen.getByText('Test Modal').closest('.relative')
    if (modalContent) {
      fireEvent.click(modalContent)
      expect(mockOnClose).not.toHaveBeenCalled()
    }
  })

  it('should close when Escape key is pressed', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should not close when other keys are pressed', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should prevent body scroll when open', () => {
    const { rerender } = render(
      <Modal
        isOpen={false}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    expect(document.body.style.overflow).toBe('')
    
    rerender(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('should restore body scroll when closed', () => {
    const { rerender, unmount } = render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
      />
    )
    
    expect(document.body.style.overflow).toBe('hidden')
    
    unmount()
    
    expect(document.body.style.overflow).toBe('')
  })

  it('should apply danger variant styling', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
        variant="danger"
      />
    )
    
    const confirmButton = screen.getByText('OK')
    expect(confirmButton.className).toContain('bg-red-500')
  })

  it('should apply default variant styling', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message="Test message"
        onConfirm={mockOnConfirm}
        variant="default"
      />
    )
    
    const confirmButton = screen.getByText('OK')
    expect(confirmButton.className).toContain('bg-primary')
  })

  it('should handle multiline messages', () => {
    const multilineMessage = 'Line 1\nLine 2\nLine 3'
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        message={multilineMessage}
        onConfirm={mockOnConfirm}
      />
    )
    
    const messageElement = screen.getByText(/Line 1/i)
    expect(messageElement).toBeInTheDocument()
  })
})

