import { describe, it, expect } from 'vitest'
import type {
  CoordinateMode,
  ViewportState,
  Vector,
  FunctionPlot,
  CoordinateFrame,
  WorkspaceState,
  FrameBounds,
  Point2D,
} from './index'

describe('Type Definitions', () => {
  describe('CoordinateMode', () => {
    it('accepts 2d mode', () => {
      const mode: CoordinateMode = '2d'
      expect(mode).toBe('2d')
    })

    it('accepts 3d mode', () => {
      const mode: CoordinateMode = '3d'
      expect(mode).toBe('3d')
    })
  })

  describe('ViewportState', () => {
    it('can be created with all required properties', () => {
      const viewport: ViewportState = {
        x: 0,
        y: 0,
        zoom: 1.0,
        gridStep: 1,
      }
      expect(viewport.x).toBe(0)
      expect(viewport.zoom).toBe(1.0)
      expect(viewport.gridStep).toBe(1)
    })
  })

  describe('Vector', () => {
    it('can be created with required properties', () => {
      const vector: Vector = {
        id: 'vec-1',
        start: [0, 0],
        end: [2, 3],
        color: '#00ff00',
      }
      expect(vector.id).toBe('vec-1')
      expect(vector.start).toEqual([0, 0])
      expect(vector.end).toEqual([2, 3])
    })

    it('can include optional label', () => {
      const vector: Vector = {
        id: 'vec-1',
        start: [0, 0],
        end: [2, 3],
        color: '#00ff00',
        label: 'My Vector',
      }
      expect(vector.label).toBe('My Vector')
    })
  })

  describe('FunctionPlot', () => {
    it('can be created with all required properties', () => {
      const plot: FunctionPlot = {
        id: 'func-1',
        expression: '2*x + 1',
        xMin: -5,
        xMax: 5,
        color: '#ff00ff',
      }
      expect(plot.expression).toBe('2*x + 1')
      expect(plot.xMin).toBe(-5)
      expect(plot.xMax).toBe(5)
    })
  })

  describe('FrameBounds', () => {
    it('can be created with all required properties', () => {
      const bounds: FrameBounds = {
        x: 10,
        y: 20,
        width: 200,
        height: 150,
      }
      expect(bounds.x).toBe(10)
      expect(bounds.width).toBe(200)
    })
  })

  describe('CoordinateFrame', () => {
    it('can be created with all required properties', () => {
      const frame: CoordinateFrame = {
        id: 'frame-1',
        origin: [0, 0],
        baseI: [1, 0],
        baseJ: [0, 1],
        bounds: {
          x: 0,
          y: 0,
          width: 200,
          height: 150,
        },
        mode: '2d',
        vectors: [],
        functions: [],
        code: '',
      }
      expect(frame.id).toBe('frame-1')
      expect(frame.mode).toBe('2d')
      expect(frame.baseI).toEqual([1, 0])
      expect(frame.baseJ).toEqual([0, 1])
    })

    it('can include vectors and functions', () => {
      const vector: Vector = {
        id: 'vec-1',
        start: [0, 0],
        end: [2, 3],
        color: '#00ff00',
      }
      const plot: FunctionPlot = {
        id: 'func-1',
        expression: 'x**2',
        xMin: -5,
        xMax: 5,
        color: '#ff00ff',
      }
      const frame: CoordinateFrame = {
        id: 'frame-1',
        origin: [0, 0],
        baseI: [1, 0],
        baseJ: [0, 1],
        bounds: {
          x: 0,
          y: 0,
          width: 200,
          height: 150,
        },
        mode: '2d',
        vectors: [vector],
        functions: [plot],
        code: 'import numpy as np',
      }
      expect(frame.vectors).toHaveLength(1)
      expect(frame.functions).toHaveLength(1)
    })
  })

  describe('WorkspaceState', () => {
    it('can be created with all required properties', () => {
      const workspace: WorkspaceState = {
        viewport: {
          x: 0,
          y: 0,
          zoom: 1.0,
          gridStep: 1,
        },
        frames: [],
        selectedFrameId: null,
      }
      expect(workspace.frames).toEqual([])
      expect(workspace.selectedFrameId).toBeNull()
    })

    it('can have selected frame', () => {
      const workspace: WorkspaceState = {
        viewport: {
          x: 0,
          y: 0,
          zoom: 1.0,
          gridStep: 1,
        },
        frames: [],
        selectedFrameId: 'frame-1',
      }
      expect(workspace.selectedFrameId).toBe('frame-1')
    })
  })

  describe('Point2D', () => {
    it('is a tuple of two numbers', () => {
      const point: Point2D = [5, 10]
      expect(point[0]).toBe(5)
      expect(point[1]).toBe(10)
    })
  })
})

