import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CoordinateFrame, ViewportState } from '../../src/types'
import { drawCoordinateFrame } from '../../src/components/CoordinateFrame'

describe('CoordinateFrame', () => {
  let mockContext: CanvasRenderingContext2D
  let defaultViewport: ViewportState
  let defaultFrame: CoordinateFrame

  beforeEach(() => {
    mockContext = {
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1.0,
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      rect: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clip: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    defaultViewport = {
      x: 0,
      y: 0,
      zoom: 50.0,
      gridStep: 1,
    }

    defaultFrame = {
      id: 'test-frame-1',
      origin: [0, 0],
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
        zoom: 1.0,
        gridStep: 1,
      },
      mode: '2d',
      vectors: [],
      functions: [],
      code: '',
      parentFrameId: null,
      childFrameIds: [],
    }
  })

  it('draws frame border', () => {
    drawCoordinateFrame(mockContext, defaultFrame, defaultViewport, 800, 600, [])
    
    expect(mockContext.beginPath).toHaveBeenCalled()
    expect(mockContext.rect).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()
  })

  it('draws base vectors', () => {
    drawCoordinateFrame(mockContext, defaultFrame, defaultViewport, 800, 600, [])
    
    // Should draw base i and base j vectors
    expect(mockContext.moveTo).toHaveBeenCalled()
    expect(mockContext.lineTo).toHaveBeenCalled()
    // Should be called at least twice (once for each vector)
    expect(mockContext.lineTo.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('draws frame origin label', () => {
    drawCoordinateFrame(mockContext, defaultFrame, defaultViewport, 800, 600, [])
    
    expect(mockContext.fillText).toHaveBeenCalledWith('O', expect.any(Number), expect.any(Number))
  })

  it('draws frame grid', () => {
    drawCoordinateFrame(mockContext, defaultFrame, defaultViewport, 800, 600, [])
    
    // Grid drawing should call moveTo and lineTo multiple times
    expect(mockContext.moveTo.mock.calls.length).toBeGreaterThan(2)
    expect(mockContext.lineTo.mock.calls.length).toBeGreaterThan(2)
  })

  it('recursively draws child frames', () => {
    const childFrame: CoordinateFrame = {
      id: 'child-frame-1',
      origin: [2, 2],
      baseI: [1, 0],
      baseJ: [0, 1],
      bounds: {
        x: 2,
        y: 2,
        width: 5,
        height: 5,
      },
      viewport: {
        x: 0,
        y: 0,
        zoom: 1.0,
        gridStep: 1,
      },
      mode: '2d',
      vectors: [],
      functions: [],
      code: '',
      parentFrameId: 'test-frame-1',
      childFrameIds: [],
    }

    const parentFrame: CoordinateFrame = {
      ...defaultFrame,
      childFrameIds: ['child-frame-1'],
    }

    drawCoordinateFrame(mockContext, parentFrame, defaultViewport, 800, 600, [parentFrame, childFrame])
    
    // Should draw both parent and child frames
    // The rect should be called at least twice (once for parent, once for child)
    expect(mockContext.rect.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('handles frames with non-standard base vectors', () => {
    const rotatedFrame: CoordinateFrame = {
      ...defaultFrame,
      baseI: [0.707, 0.707], // 45 degree rotation
      baseJ: [-0.707, 0.707],
    }

    drawCoordinateFrame(mockContext, rotatedFrame, defaultViewport, 800, 600, [])
    
    // Should still draw the frame
    expect(mockContext.beginPath).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()
  })
})

