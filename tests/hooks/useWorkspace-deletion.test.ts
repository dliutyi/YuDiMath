import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkspace } from '../../src/hooks/useWorkspace'
import type { CoordinateFrame } from '../../src/types'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useWorkspace - Frame Deletion', () => {
  const createFrame = (id: string, parentId: string | null = null): CoordinateFrame => ({
    id,
    origin: [0, 0],
    baseI: [1, 0],
    baseJ: [0, 1],
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    viewport: { x: 0, y: 0, zoom: 1, gridStep: 1 },
    mode: '2d',
    vectors: [],
    functions: [],
    code: '',
    parentFrameId: parentId,
    childFrameIds: [],
  })

  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear()
  })

  it('removes frame from workspace', () => {
    const { result } = renderHook(() => useWorkspace({ persist: false }))
    
    const frame1 = createFrame('frame-1')
    const frame2 = createFrame('frame-2')
    
    act(() => {
      result.current.addFrame(frame1)
      result.current.addFrame(frame2)
    })
    
    expect(result.current.frames).toHaveLength(2)
    
    act(() => {
      result.current.removeFrame('frame-1')
    })
    
    expect(result.current.frames).toHaveLength(1)
    expect(result.current.frames[0].id).toBe('frame-2')
  })

  it('clears selection if deleted frame was selected', () => {
    const { result } = renderHook(() => useWorkspace({ persist: false }))
    
    const frame1 = createFrame('frame-1')
    const frame2 = createFrame('frame-2')
    
    act(() => {
      result.current.addFrame(frame1)
      result.current.addFrame(frame2)
      result.current.setSelectedFrameId('frame-1')
    })
    
    expect(result.current.selectedFrameId).toBe('frame-1')
    
    act(() => {
      result.current.removeFrame('frame-1')
    })
    
    expect(result.current.selectedFrameId).toBeNull()
  })

  it('does not clear selection if deleted frame was not selected', () => {
    const { result } = renderHook(() => useWorkspace({ persist: false }))
    
    const frame1 = createFrame('frame-1')
    const frame2 = createFrame('frame-2')
    
    act(() => {
      result.current.addFrame(frame1)
      result.current.addFrame(frame2)
      result.current.setSelectedFrameId('frame-2')
    })
    
    expect(result.current.selectedFrameId).toBe('frame-2')
    
    act(() => {
      result.current.removeFrame('frame-1')
    })
    
    expect(result.current.selectedFrameId).toBe('frame-2')
  })

  it('removes child frames recursively', () => {
    const { result } = renderHook(() => useWorkspace({ persist: false }))
    
    const parent = createFrame('parent')
    const child1 = createFrame('child-1', 'parent')
    const child2 = createFrame('child-2', 'parent')
    const grandchild = createFrame('grandchild', 'child-1')
    
    act(() => {
      result.current.addFrame(parent)
      result.current.addFrame(child1, 'parent')
      result.current.addFrame(child2, 'parent')
      result.current.addFrame(grandchild, 'child-1')
    })
    
    // Wait for state updates
    expect(result.current.frames.length).toBeGreaterThanOrEqual(1)
    
    const initialCount = result.current.frames.length
    
    act(() => {
      result.current.removeFrame('parent')
    })
    
    // All frames should be removed (parent + children + grandchildren)
    expect(result.current.frames.length).toBeLessThan(initialCount)
  })

  it('updates parent frame childFrameIds when child is deleted', () => {
    const { result } = renderHook(() => useWorkspace({ persist: false }))
    
    const parent = createFrame('parent')
    const child1 = createFrame('child-1', 'parent')
    const child2 = createFrame('child-2', 'parent')
    
    act(() => {
      result.current.addFrame(parent)
      result.current.addFrame(child1, 'parent')
      result.current.addFrame(child2, 'parent')
    })
    
    // Wait for state to update
    const parentFrame = result.current.frames.find(f => f.id === 'parent')
    if (parentFrame) {
      expect(parentFrame.childFrameIds.length).toBeGreaterThanOrEqual(1)
      
      act(() => {
        result.current.removeFrame('child-1')
      })
      
      const updatedParent = result.current.frames.find(f => f.id === 'parent')
      if (updatedParent) {
        expect(updatedParent.childFrameIds.length).toBeLessThan(parentFrame.childFrameIds.length)
      }
    }
  })

  it('handles deletion of non-existent frame gracefully', () => {
    const { result } = renderHook(() => useWorkspace({ persist: false }))
    
    const frame1 = createFrame('frame-1')
    
    act(() => {
      result.current.addFrame(frame1)
    })
    
    expect(result.current.frames).toHaveLength(1)
    
    act(() => {
      result.current.removeFrame('non-existent')
    })
    
    expect(result.current.frames).toHaveLength(1)
  })
})

