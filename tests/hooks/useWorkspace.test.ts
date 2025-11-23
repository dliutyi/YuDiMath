import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkspace } from '../../src/hooks/useWorkspace'
import type { CoordinateFrame, ViewportState } from '../../src/types'

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

describe('useWorkspace', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useWorkspace())

      expect(result.current.viewport).toEqual({
        x: 0,
        y: 0,
        zoom: 50.0,
        gridStep: 1,
      })
      expect(result.current.frames).toEqual([])
      expect(result.current.selectedFrameId).toBeNull()
      expect(result.current.selectedFrame).toBeNull()
    })

    it('should load state from localStorage when persist is enabled', () => {
      const savedState = {
        viewport: { x: 10, y: 20, zoom: 2.0, gridStep: 0.5 },
        frames: [],
        selectedFrameId: null,
      }
      localStorageMock.setItem('yudimath-workspace', JSON.stringify(savedState))

      const { result } = renderHook(() => useWorkspace({ persist: true }))

      expect(result.current.viewport).toEqual(savedState.viewport)
    })

    it('should use default state if localStorage is invalid', () => {
      localStorageMock.setItem('yudimath-workspace', 'invalid json')

      const { result } = renderHook(() => useWorkspace({ persist: true }))

      expect(result.current.viewport).toEqual({
        x: 0,
        y: 0,
        zoom: 50.0,
        gridStep: 1,
      })
    })
  })

  describe('viewport management', () => {
    it('should update viewport with setViewport', () => {
      const { result } = renderHook(() => useWorkspace())

      act(() => {
        result.current.setViewport({ x: 10, y: 20, zoom: 2.0, gridStep: 0.5 })
      })

      expect(result.current.viewport).toEqual({ x: 10, y: 20, zoom: 2.0, gridStep: 0.5 })
    })

    it('should update viewport with function updater', () => {
      const { result } = renderHook(() => useWorkspace())

      act(() => {
        result.current.setViewport((prev) => ({ ...prev, x: 100 }))
      })

      expect(result.current.viewport.x).toBe(100)
      expect(result.current.viewport.y).toBe(0)
    })

    it('should update viewport partially with updateViewport', () => {
      const { result } = renderHook(() => useWorkspace())

      act(() => {
        result.current.updateViewport({ zoom: 2.0 })
      })

      expect(result.current.viewport.zoom).toBe(2.0)
      expect(result.current.viewport.x).toBe(0)
      expect(result.current.viewport.y).toBe(0)
      expect(result.current.viewport.gridStep).toBe(1)
    })

    it('should reset viewport to default', () => {
      const { result } = renderHook(() => useWorkspace())

      act(() => {
        result.current.setViewport({ x: 100, y: 200, zoom: 3.0, gridStep: 2.0 })
      })

      act(() => {
        result.current.resetViewport()
      })

      expect(result.current.viewport).toEqual({
        x: 0,
        y: 0,
        zoom: 50.0,
        gridStep: 1,
      })
    })
  })

  describe('frame management', () => {
    const createMockFrame = (id: string, parentFrameId: string | null = null): CoordinateFrame => ({
      id,
      origin: [0, 0],
      baseI: [1, 0],
      baseJ: [0, 1],
      bounds: {
        minU: 0,
        maxU: 100,
        minV: 0,
        maxV: 100,
      },
      viewport: { x: 0, y: 0, zoom: 1.0, gridStep: 1 },
      mode: '2d',
      vectors: [],
      functions: [],
      code: '',
      parentFrameId,
      childFrameIds: [],
    })

    it('should add a frame', () => {
      const { result } = renderHook(() => useWorkspace())
      const frame = createMockFrame('frame1')

      act(() => {
        result.current.addFrame(frame, null)
      })

      expect(result.current.frames).toHaveLength(1)
      expect(result.current.frames[0]).toEqual(frame)
      expect(result.current.selectedFrameId).toBe('frame1')
    })

    it('should add a nested frame and update parent', () => {
      const { result } = renderHook(() => useWorkspace())
      const parentFrame = createMockFrame('parent')
      const childFrame = createMockFrame('child', 'parent')

      act(() => {
        result.current.addFrame(parentFrame, null)
      })

      act(() => {
        result.current.addFrame(childFrame, 'parent')
      })

      expect(result.current.frames).toHaveLength(2)
      const parent = result.current.frames.find((f) => f.id === 'parent')
      expect(parent?.childFrameIds).toContain('child')
    })

    it('should remove a frame', () => {
      const { result } = renderHook(() => useWorkspace())
      const frame1 = createMockFrame('frame1')
      const frame2 = createMockFrame('frame2')

      act(() => {
        result.current.addFrame(frame1, null)
        result.current.addFrame(frame2, null)
      })

      act(() => {
        result.current.removeFrame('frame1')
      })

      expect(result.current.frames).toHaveLength(1)
      expect(result.current.frames[0].id).toBe('frame2')
    })

    it('should remove nested frames recursively', () => {
      const { result } = renderHook(() => useWorkspace())
      const parent = createMockFrame('parent')
      const child1 = createMockFrame('child1', 'parent')
      const child2 = createMockFrame('child2', 'parent')
      const grandchild = createMockFrame('grandchild', 'child1')

      act(() => {
        result.current.addFrame(parent, null)
        result.current.addFrame(child1, 'parent')
        result.current.addFrame(child2, 'parent')
        result.current.addFrame(grandchild, 'child1')
      })

      act(() => {
        result.current.removeFrame('parent')
      })

      expect(result.current.frames).toHaveLength(0)
    })

    it('should update parent childFrameIds when removing nested frame', () => {
      const { result } = renderHook(() => useWorkspace())
      const parent = createMockFrame('parent')
      const child = createMockFrame('child', 'parent')

      act(() => {
        result.current.addFrame(parent, null)
        result.current.addFrame(child, 'parent')
      })

      act(() => {
        result.current.removeFrame('child')
      })

      const updatedParent = result.current.frames.find((f) => f.id === 'parent')
      expect(updatedParent?.childFrameIds).not.toContain('child')
      expect(updatedParent?.childFrameIds).toHaveLength(0)
    })

    it('should clear selectedFrameId when removing selected frame', () => {
      const { result } = renderHook(() => useWorkspace())
      const frame = createMockFrame('frame1')

      act(() => {
        result.current.addFrame(frame, null)
      })

      expect(result.current.selectedFrameId).toBe('frame1')

      act(() => {
        result.current.removeFrame('frame1')
      })

      expect(result.current.selectedFrameId).toBeNull()
    })

    it('should update a frame', () => {
      const { result } = renderHook(() => useWorkspace())
      const frame = createMockFrame('frame1')

      act(() => {
        result.current.addFrame(frame, null)
      })

      act(() => {
        result.current.updateFrame('frame1', { origin: [10, 20] })
      })

      const updatedFrame = result.current.frames.find((f) => f.id === 'frame1')
      expect(updatedFrame?.origin).toEqual([10, 20])
    })

    it('should update frame viewport', () => {
      const { result } = renderHook(() => useWorkspace())
      const frame = createMockFrame('frame1')
      const newViewport: ViewportState = { x: 50, y: 50, zoom: 2.0, gridStep: 0.5 }

      act(() => {
        result.current.addFrame(frame, null)
      })

      act(() => {
        result.current.updateFrameViewport('frame1', newViewport)
      })

      const updatedFrame = result.current.frames.find((f) => f.id === 'frame1')
      expect(updatedFrame?.viewport).toEqual(newViewport)
    })
  })

  describe('selection management', () => {
    it('should set selected frame ID', () => {
      const { result } = renderHook(() => useWorkspace())
      const frame = {
        id: 'frame1',
        origin: [0, 0],
        baseI: [1, 0],
        baseJ: [0, 1],
        bounds: { minU: 0, maxU: 100, minV: 0, maxV: 100 },
        viewport: { x: 0, y: 0, zoom: 1.0, gridStep: 1 },
        mode: '2d' as const,
        vectors: [],
        functions: [],
        code: '',
        parentFrameId: null,
        childFrameIds: [],
      }

      act(() => {
        result.current.addFrame(frame, null)
        result.current.setSelectedFrameId('frame1')
      })

      expect(result.current.selectedFrameId).toBe('frame1')
      expect(result.current.selectedFrame).toEqual(frame)
    })

    it('should return null for selectedFrame when frame does not exist', () => {
      const { result } = renderHook(() => useWorkspace())

      act(() => {
        result.current.setSelectedFrameId('nonexistent')
      })

      expect(result.current.selectedFrame).toBeNull()
    })
  })

  describe('workspace utilities', () => {
    it('should clear workspace', () => {
      const { result } = renderHook(() => useWorkspace())
      const frame = {
        id: 'frame1',
        origin: [0, 0],
        baseI: [1, 0],
        baseJ: [0, 1],
        bounds: { minU: 0, maxU: 100, minV: 0, maxV: 100 },
        viewport: { x: 0, y: 0, zoom: 1.0, gridStep: 1 },
        mode: '2d' as const,
        vectors: [],
        functions: [],
        code: '',
        parentFrameId: null,
        childFrameIds: [],
      }

      act(() => {
        result.current.addFrame(frame, null)
        result.current.setViewport({ x: 100, y: 200, zoom: 2.0, gridStep: 0.5 })
      })

      act(() => {
        result.current.clearWorkspace()
      })

      expect(result.current.frames).toHaveLength(0)
      expect(result.current.viewport).toEqual({
        x: 0,
        y: 0,
        zoom: 50.0,
        gridStep: 1,
      })
      expect(result.current.selectedFrameId).toBeNull()
    })

    it('should clear localStorage when clearing workspace with persistence', () => {
      const { result } = renderHook(() => useWorkspace({ persist: true }))

      act(() => {
        result.current.setViewport({ x: 100, y: 200, zoom: 2.0, gridStep: 0.5 })
      })

      expect(localStorageMock.getItem('yudimath-workspace')).toBeTruthy()

      act(() => {
        result.current.clearWorkspace()
      })

      expect(localStorageMock.getItem('yudimath-workspace')).toBeNull()
    })
  })

  describe('localStorage persistence', () => {
    it('should save state to localStorage when persist is enabled', () => {
      const { result } = renderHook(() => useWorkspace({ persist: true }))

      act(() => {
        result.current.setViewport({ x: 10, y: 20, zoom: 2.0, gridStep: 0.5 })
      })

      const saved = JSON.parse(localStorageMock.getItem('yudimath-workspace') || '{}')
      expect(saved.viewport).toEqual({ x: 10, y: 20, zoom: 2.0, gridStep: 0.5 })
    })

    it('should not save to localStorage when persist is disabled', () => {
      const { result } = renderHook(() => useWorkspace({ persist: false }))

      act(() => {
        result.current.setViewport({ x: 10, y: 20, zoom: 2.0, gridStep: 0.5 })
      })

      expect(localStorageMock.getItem('yudimath-workspace')).toBeNull()
    })
  })
})

