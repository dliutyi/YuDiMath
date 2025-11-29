import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drawFrameParametricPlots } from '../../src/utils/parametricDrawing'
import type { CoordinateFrame, ViewportState, ParametricPlot } from '../../src/types'

describe('drawFrameParametricPlots', () => {
  let mockCtx: CanvasRenderingContext2D
  let mockFrame: CoordinateFrame
  let mockViewport: ViewportState

  beforeEach(() => {
    // Create a mock canvas context
    mockCtx = {
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1,
      imageSmoothingEnabled: true,
      beginPath: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    mockViewport = {
      x: 0,
      y: 0,
      zoom: 50,
      gridStep: 1,
    }

    mockFrame = {
      id: 'test-frame-1',
      origin: [0, 0],
      baseI: [1, 0],
      baseJ: [0, 1],
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
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
      parametricPlots: [],
      implicitPlots: [],
      code: '',
      parentFrameId: null,
      childFrameIds: [],
    }
  })

  describe('Circle rendering', () => {
    it('should render a circle parametric plot', () => {
      const circlePlot: ParametricPlot = {
        id: 'circle-1',
        xFunc: 'cos(t)',
        yFunc: 'sin(t)',
        tMin: 0,
        tMax: 2 * Math.PI,
        color: '#ff0000',
        numPoints: 100,
      }

      mockFrame.parametricPlots = [circlePlot]

      drawFrameParametricPlots(mockCtx, mockFrame, mockViewport, 800, 600)

      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
      expect(mockCtx.strokeStyle).toBe('#ff0000')
    })
  })

  describe('Ellipse rendering', () => {
    it('should render an ellipse parametric plot', () => {
      const ellipsePlot: ParametricPlot = {
        id: 'ellipse-1',
        xFunc: '2*cos(t)',
        yFunc: 'sin(t)',
        tMin: 0,
        tMax: 2 * Math.PI,
        color: '#00ff00',
        numPoints: 100,
      }

      mockFrame.parametricPlots = [ellipsePlot]

      drawFrameParametricPlots(mockCtx, mockFrame, mockViewport, 800, 600)

      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
      expect(mockCtx.strokeStyle).toBe('#00ff00')
    })
  })

  describe('Multiple parametric plots', () => {
    it('should render multiple parametric plots', () => {
      const plot1: ParametricPlot = {
        id: 'plot-1',
        xFunc: 'cos(t)',
        yFunc: 'sin(t)',
        tMin: 0,
        tMax: 2 * Math.PI,
        color: '#ff0000',
      }

      const plot2: ParametricPlot = {
        id: 'plot-2',
        xFunc: '2*cos(t)',
        yFunc: '2*sin(t)',
        tMin: 0,
        tMax: 2 * Math.PI,
        color: '#00ff00',
      }

      mockFrame.parametricPlots = [plot1, plot2]

      drawFrameParametricPlots(mockCtx, mockFrame, mockViewport, 800, 600)

      expect(mockCtx.beginPath).toHaveBeenCalledTimes(2)
      expect(mockCtx.stroke).toHaveBeenCalledTimes(2)
    })
  })

  describe('Different t ranges', () => {
    it('should handle different t ranges', () => {
      const plot1: ParametricPlot = {
        id: 'plot-1',
        xFunc: 't',
        yFunc: 't**2',
        tMin: 0,
        tMax: 5,
        color: '#ff0000',
      }

      const plot2: ParametricPlot = {
        id: 'plot-2',
        xFunc: 't',
        yFunc: 't**2',
        tMin: -5,
        tMax: 0,
        color: '#00ff00',
      }

      mockFrame.parametricPlots = [plot1, plot2]

      drawFrameParametricPlots(mockCtx, mockFrame, mockViewport, 800, 600)

      expect(mockCtx.beginPath).toHaveBeenCalledTimes(2)
      expect(mockCtx.stroke).toHaveBeenCalledTimes(2)
    })
  })

  describe('Pre-computed points', () => {
    it('should render parametric plot from pre-computed points', () => {
      const points: Array<[number, number]> = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, 0],
      ]

      const plot: ParametricPlot = {
        id: 'plot-1',
        xFunc: 'cos(t)',
        yFunc: 'sin(t)',
        tMin: 0,
        tMax: 2 * Math.PI,
        color: '#ff0000',
        points,
      }

      mockFrame.parametricPlots = [plot]

      drawFrameParametricPlots(mockCtx, mockFrame, mockViewport, 800, 600)

      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
    })
  })

  describe('Discontinuity handling', () => {
    it('should handle parametric plots with discontinuities', () => {
      // Plot with potential discontinuities (e.g., tan function)
      const plot: ParametricPlot = {
        id: 'plot-1',
        xFunc: 't',
        yFunc: 'tan(t)',
        tMin: -Math.PI / 2 + 0.1,
        tMax: Math.PI / 2 - 0.1,
        color: '#ff0000',
      }

      mockFrame.parametricPlots = [plot]

      drawFrameParametricPlots(mockCtx, mockFrame, mockViewport, 800, 600)

      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
    })
  })

  describe('Empty plots', () => {
    it('should handle frame with no parametric plots', () => {
      mockFrame.parametricPlots = []

      drawFrameParametricPlots(mockCtx, mockFrame, mockViewport, 800, 600)

      expect(mockCtx.beginPath).not.toHaveBeenCalled()
      expect(mockCtx.stroke).not.toHaveBeenCalled()
    })

    it('should handle plot with no points or expressions', () => {
      const plot: ParametricPlot = {
        id: 'plot-1',
        xFunc: '',
        yFunc: '',
        tMin: 0,
        tMax: 1,
        color: '#ff0000',
      }

      mockFrame.parametricPlots = [plot]

      // Should not throw, but should skip the plot
      expect(() => {
        drawFrameParametricPlots(mockCtx, mockFrame, mockViewport, 800, 600)
      }).not.toThrow()
    })
  })
})

