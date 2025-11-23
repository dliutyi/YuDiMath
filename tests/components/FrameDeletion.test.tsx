import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PropertiesPanel from '../../src/components/PropertiesPanel'
import type { CoordinateFrame } from '../../src/types'

describe('Frame Deletion', () => {
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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Delete Button', () => {
    it('renders delete button when onFrameDelete is provided', () => {
      const onFrameDelete = vi.fn()
      render(
        <PropertiesPanel
          selectedFrame={mockFrame}
          onFrameUpdate={vi.fn()}
          onFrameDelete={onFrameDelete}
        />
      )
      
      const deleteButton = screen.getByTitle('Delete Frame (Delete key)')
      expect(deleteButton).toBeInTheDocument()
    })

    it('does not render delete button when onFrameDelete is not provided', () => {
      render(
        <PropertiesPanel
          selectedFrame={mockFrame}
          onFrameUpdate={vi.fn()}
        />
      )
      
      const deleteButton = screen.queryByTitle('Delete Frame (Delete key)')
      expect(deleteButton).not.toBeInTheDocument()
    })

    it('calls onFrameDelete with frame id when delete button is clicked', () => {
      const onFrameDelete = vi.fn()
      render(
        <PropertiesPanel
          selectedFrame={mockFrame}
          onFrameUpdate={vi.fn()}
          onFrameDelete={onFrameDelete}
        />
      )
      
      const deleteButton = screen.getByTitle('Delete Frame (Delete key)')
      fireEvent.click(deleteButton)
      
      expect(onFrameDelete).toHaveBeenCalledTimes(1)
      expect(onFrameDelete).toHaveBeenCalledWith('test-frame-1')
    })

    it('does not call onFrameDelete when no frame is selected', () => {
      const onFrameDelete = vi.fn()
      render(
        <PropertiesPanel
          selectedFrame={null}
          onFrameUpdate={vi.fn()}
          onFrameDelete={onFrameDelete}
        />
      )
      
      const deleteButton = screen.queryByTitle('Delete Frame (Delete key)')
      expect(deleteButton).not.toBeInTheDocument()
    })
  })
})

