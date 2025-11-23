import { useState, useCallback, useEffect } from 'react'
import type { ViewportState, CoordinateFrame, WorkspaceState } from '../types'

const STORAGE_KEY = 'yudimath-workspace'

/**
 * Default viewport state
 */
const DEFAULT_VIEWPORT: ViewportState = {
  x: 0,
  y: 0,
  zoom: 50.0, // Default: 1 unit = 50px
  gridStep: 1, // Default to 1 unit - the fundamental coordinate system step
}

/**
 * Default workspace state
 */
const DEFAULT_WORKSPACE: WorkspaceState = {
  viewport: DEFAULT_VIEWPORT,
  frames: [],
  selectedFrameId: null,
}

/**
 * Hook for managing workspace state (viewport, frames, selected frame)
 * Optionally persists state to localStorage
 */
export function useWorkspace(options: { persist?: boolean } = {}) {
  const { persist = false } = options

  // Load initial state from localStorage if persistence is enabled
  // IMPORTANT: Only access localStorage if persist is true
  const loadInitialState = useCallback((): WorkspaceState => {
    if (!persist) {
      return DEFAULT_WORKSPACE
    }

    // Only access localStorage when persist is enabled
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as WorkspaceState
          // Validate structure
          if (
            parsed.viewport &&
            typeof parsed.viewport.x === 'number' &&
            typeof parsed.viewport.y === 'number' &&
            typeof parsed.viewport.zoom === 'number' &&
            typeof parsed.viewport.gridStep === 'number' &&
            Array.isArray(parsed.frames) &&
            (parsed.selectedFrameId === null || typeof parsed.selectedFrameId === 'string')
          ) {
            return parsed
          }
        }
      } catch (error) {
        console.warn('[useWorkspace] Failed to load state from localStorage:', error)
      }
    }

    return DEFAULT_WORKSPACE
  }, [persist])

  const [workspace, setWorkspace] = useState<WorkspaceState>(loadInitialState)

  // Persist state to localStorage when it changes
  // IMPORTANT: Only access localStorage if persist is true
  // Skip persistence if workspace is default (to allow clearWorkspace to work properly)
  useEffect(() => {
    // Early return if persistence is disabled - don't access localStorage at all
    if (!persist) {
      return
    }

    // Only access localStorage when persist is enabled and window is available
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    // Only persist if not default workspace (allows clearWorkspace to remove from storage)
    const isDefault =
      workspace.viewport.x === DEFAULT_VIEWPORT.x &&
      workspace.viewport.y === DEFAULT_VIEWPORT.y &&
      workspace.viewport.zoom === DEFAULT_VIEWPORT.zoom &&
      workspace.viewport.gridStep === DEFAULT_VIEWPORT.gridStep &&
      workspace.frames.length === 0 &&
      workspace.selectedFrameId === null

    if (!isDefault) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
      } catch (error) {
        console.warn('[useWorkspace] Failed to save state to localStorage:', error)
      }
    } else {
      // If default state, remove from storage
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.warn('[useWorkspace] Failed to remove from localStorage:', error)
      }
    }
  }, [workspace, persist])

  // Viewport management
  const setViewport = useCallback((viewport: ViewportState | ((prev: ViewportState) => ViewportState)) => {
    setWorkspace((prev) => ({
      ...prev,
      viewport: typeof viewport === 'function' ? viewport(prev.viewport) : viewport,
    }))
  }, [])

  const updateViewport = useCallback((updates: Partial<ViewportState>) => {
    setWorkspace((prev) => ({
      ...prev,
      viewport: { ...prev.viewport, ...updates },
    }))
  }, [])

  // Frame management
  const addFrame = useCallback((frame: CoordinateFrame, parentFrameId: string | null) => {
    setWorkspace((prev) => {
      const newFrames = [...prev.frames, frame]

      // If there's a parent frame, update its childFrameIds
      if (parentFrameId) {
        const parentIndex = newFrames.findIndex((f) => f.id === parentFrameId)
        if (parentIndex !== -1) {
          newFrames[parentIndex] = {
            ...newFrames[parentIndex],
            childFrameIds: [...newFrames[parentIndex].childFrameIds, frame.id],
          }
        }
      }

      return {
        ...prev,
        frames: newFrames,
        selectedFrameId: frame.id, // Auto-select newly created frame
      }
    })
  }, [])

  const removeFrame = useCallback((frameId: string) => {
    setWorkspace((prev) => {
      const frameToRemove = prev.frames.find((f) => f.id === frameId)
      if (!frameToRemove) return prev

      // Remove frame and all its descendants recursively
      const removeFrameAndChildren = (id: string, frames: CoordinateFrame[]): CoordinateFrame[] => {
        const frame = frames.find((f) => f.id === id)
        if (!frame) return frames

        // First remove all children
        let remaining = frames.filter((f) => f.id !== id)
        for (const childId of frame.childFrameIds) {
          remaining = removeFrameAndChildren(childId, remaining)
        }

        // Update parent frame's childFrameIds if this frame had a parent
        if (frame.parentFrameId) {
          remaining = remaining.map((f) => {
            if (f.id === frame.parentFrameId) {
              return {
                ...f,
                childFrameIds: f.childFrameIds.filter((cid) => cid !== id),
              }
            }
            return f
          })
        }

        return remaining
      }

      const newFrames = removeFrameAndChildren(frameId, prev.frames)
      const newSelectedFrameId =
        prev.selectedFrameId === frameId ? null : prev.selectedFrameId

      return {
        ...prev,
        frames: newFrames,
        selectedFrameId: newSelectedFrameId,
      }
    })
  }, [])

  const updateFrame = useCallback((frameId: string, updates: Partial<CoordinateFrame>) => {
    setWorkspace((prev) => ({
      ...prev,
      frames: prev.frames.map((frame) => (frame.id === frameId ? { ...frame, ...updates } : frame)),
    }))
  }, [])

  const updateFrameViewport = useCallback((frameId: string, viewport: ViewportState) => {
    updateFrame(frameId, { viewport })
  }, [updateFrame])

  // Selected frame management
  const setSelectedFrameId = useCallback((frameId: string | null) => {
    setWorkspace((prev) => ({
      ...prev,
      selectedFrameId: frameId,
    }))
  }, [])

  const getSelectedFrame = useCallback((): CoordinateFrame | null => {
    return workspace.frames.find((f) => f.id === workspace.selectedFrameId) || null
  }, [workspace.frames, workspace.selectedFrameId])

  // Utility functions
  const clearWorkspace = useCallback(() => {
    setWorkspace(DEFAULT_WORKSPACE)
    // localStorage will be cleared by the useEffect when workspace becomes default
    // But also explicitly clear it if persist is enabled
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.warn('[useWorkspace] Failed to clear localStorage:', error)
      }
    }
  }, [persist])

  const resetViewport = useCallback(() => {
    setWorkspace((prev) => ({
      ...prev,
      viewport: DEFAULT_VIEWPORT,
    }))
  }, [])

  return {
    // State
    viewport: workspace.viewport,
    frames: workspace.frames,
    selectedFrameId: workspace.selectedFrameId,
    selectedFrame: getSelectedFrame(),

    // Viewport actions
    setViewport,
    updateViewport,

    // Frame actions
    addFrame,
    removeFrame,
    updateFrame,
    updateFrameViewport,

    // Selection actions
    setSelectedFrameId,

    // Utility actions
    clearWorkspace,
    resetViewport,

    // Direct state setter (for advanced use cases)
    setWorkspace,
  }
}

