import { useState, useEffect } from 'react'
import type { CoordinateFrame, Point2D, ViewportState } from '../types'
import { areVectorsCollinear, normalizeVector, vectorMagnitude, orthogonalVector } from '../utils/vectorUtils'
import ParameterSliders from './ParameterSliders'

interface PropertiesPanelProps {
  selectedFrame: CoordinateFrame | null
  onFrameUpdate: (frameId: string, updates: Partial<CoordinateFrame>) => void
  onFrameViewportChange?: (frameId: string, viewport: ViewportState) => void
  onCodeRun?: (frameId: string, code: string) => void
}

export default function PropertiesPanel({
  selectedFrame,
  onFrameUpdate,
  onFrameViewportChange,
  onCodeRun,
}: PropertiesPanelProps) {
  const [originX, setOriginX] = useState<string>('0')
  const [originY, setOriginY] = useState<string>('0')
  const [baseIX, setBaseIX] = useState<number>(1)
  const [baseIY, setBaseIY] = useState<number>(0)
  const [baseJX, setBaseJX] = useState<number>(0)
  const [baseJY, setBaseJY] = useState<number>(1)
  const [normalizeEnabled, setNormalizeEnabled] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Update form when selected frame changes
  useEffect(() => {
    if (selectedFrame) {
      setOriginX(selectedFrame.origin[0].toString())
      setOriginY(selectedFrame.origin[1].toString())
      setBaseIX(selectedFrame.baseI[0])
      setBaseIY(selectedFrame.baseI[1])
      setBaseJX(selectedFrame.baseJ[0])
      setBaseJY(selectedFrame.baseJ[1])
      setError(null)
    }
  }, [selectedFrame])

  const parseNumber = (value: string): number | null => {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? null : parsed
  }

  const updateFrame = (
    newOriginX: string,
    newOriginY: string,
    newBaseIX: number,
    newBaseIY: number,
    newBaseJX: number,
    newBaseJY: number,
    normalize: boolean,
    changedVector: 'baseI' | 'baseJ' | 'none' = 'none'
  ) => {
    if (!selectedFrame) return

    const originXNum = parseNumber(newOriginX)
    const originYNum = parseNumber(newOriginY)

    // Check if origin values are valid numbers
    if (originXNum === null || originYNum === null) {
      setError('Origin values must be valid numbers')
      return
    }

    let baseI: Point2D = [newBaseIX, newBaseIY]
    let baseJ: Point2D = [newBaseJX, newBaseJY]

    // Normalize base vectors if enabled
    if (normalize) {
      if (changedVector === 'baseI') {
        // baseI was changed: normalize it and adjust baseJ to be orthogonal
        const normalizedI = normalizeVector(baseI)
        
        if (vectorMagnitude(normalizedI) < 1e-10) {
          setError('Base I vector cannot be zero')
          return
        }
        
        baseI = normalizedI
        // Make baseJ orthogonal to baseI and normalized
        baseJ = orthogonalVector(baseI)
        
        // Update state to reflect the changes
        setBaseIX(baseI[0])
        setBaseIY(baseI[1])
        setBaseJX(baseJ[0])
        setBaseJY(baseJ[1])
      } else if (changedVector === 'baseJ') {
        // baseJ was changed: normalize it and adjust baseI to be orthogonal
        const normalizedJ = normalizeVector(baseJ)
        
        if (vectorMagnitude(normalizedJ) < 1e-10) {
          setError('Base J vector cannot be zero')
          return
        }
        
        baseJ = normalizedJ
        // Make baseI orthogonal to baseJ and normalized
        baseI = orthogonalVector(baseJ)
        
        // Update state to reflect the changes
        setBaseIX(baseI[0])
        setBaseIY(baseI[1])
        setBaseJX(baseJ[0])
        setBaseJY(baseJ[1])
      } else {
        // No specific vector changed (e.g., toggle enabled): normalize current vectors
        const normalizedI = normalizeVector(baseI)
        const normalizedJ = normalizeVector(baseJ)
        
        if (vectorMagnitude(normalizedI) < 1e-10 || vectorMagnitude(normalizedJ) < 1e-10) {
          setError('Base vectors cannot be zero')
          return
        }
        
        baseI = normalizedI
        baseJ = normalizedJ
        
        // Update state to reflect the normalized values
        setBaseIX(baseI[0])
        setBaseIY(baseI[1])
        setBaseJX(baseJ[0])
        setBaseJY(baseJ[1])
      }
    }

    // Check for degenerate cases (allow them but show warning)
    const baseIMagnitude = Math.sqrt(baseI[0] ** 2 + baseI[1] ** 2)
    const baseJMagnitude = Math.sqrt(baseJ[0] ** 2 + baseJ[1] ** 2)
    const areZero = baseIMagnitude < 1e-10 && baseJMagnitude < 1e-10
    const areCollinear = !areZero && areVectorsCollinear(baseI, baseJ)
    
    if (areZero) {
      setError('Warning: Base vectors are zero - grid will collapse to a point')
    } else if (areCollinear) {
      setError('Warning: Base vectors are collinear - grid will collapse to a line')
    } else {
      setError(null)
    }

    // Update frame
    onFrameUpdate(selectedFrame.id, {
      origin: [originXNum, originYNum],
      baseI,
      baseJ,
    })
  }

  const handleOriginXChange = (value: string) => {
    setOriginX(value)
    updateFrame(value, originY, baseIX, baseIY, baseJX, baseJY, normalizeEnabled, 'none')
  }

  const handleOriginYChange = (value: string) => {
    setOriginY(value)
    updateFrame(originX, value, baseIX, baseIY, baseJX, baseJY, normalizeEnabled, 'none')
  }

  const handleBaseIXChange = (value: number) => {
    setBaseIX(value)
    updateFrame(originX, originY, value, baseIY, baseJX, baseJY, normalizeEnabled, 'baseI')
  }

  const handleBaseIYChange = (value: number) => {
    setBaseIY(value)
    updateFrame(originX, originY, baseIX, value, baseJX, baseJY, normalizeEnabled, 'baseI')
  }

  const handleBaseJXChange = (value: number) => {
    setBaseJX(value)
    updateFrame(originX, originY, baseIX, baseIY, value, baseJY, normalizeEnabled, 'baseJ')
  }

  const handleBaseJYChange = (value: number) => {
    setBaseJY(value)
    updateFrame(originX, originY, baseIX, baseIY, baseJX, value, normalizeEnabled, 'baseJ')
  }

  const handleNormalizeToggle = (enabled: boolean) => {
    setNormalizeEnabled(enabled)
    // When enabling normalization, normalize the current vectors from the frame
    if (enabled && selectedFrame) {
      updateFrame(originX, originY, selectedFrame.baseI[0], selectedFrame.baseI[1], selectedFrame.baseJ[0], selectedFrame.baseJ[1], true, 'none')
    }
  }

  if (!selectedFrame) {
    return null
  }

  // Calculate degenerate status for display
  const baseIMagnitude = Math.sqrt(selectedFrame.baseI[0] ** 2 + selectedFrame.baseI[1] ** 2)
  const baseJMagnitude = Math.sqrt(selectedFrame.baseJ[0] ** 2 + selectedFrame.baseJ[1] ** 2)
  const areZero = baseIMagnitude < 1e-10 && baseJMagnitude < 1e-10
  const areCollinear = !areZero && areVectorsCollinear(selectedFrame.baseI, selectedFrame.baseJ)
  const isDegenerate = areZero || areCollinear
  
  let degenerateStatus: string | null = null
  let degenerateColor = ''
  if (areZero) {
    degenerateStatus = 'Degenerate: Zero base vectors (grid collapsed to a point)'
    degenerateColor = 'text-red-500'
  } else if (areCollinear) {
    degenerateStatus = 'Degenerate: Collinear base vectors (grid collapsed to a line)'
    degenerateColor = 'text-orange-500'
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Frame Properties</h2>
      
      {degenerateStatus && (
        <div className={`mb-4 p-3 bg-warning/20 border border-warning/50 rounded text-sm font-medium ${degenerateColor}`}>
          {degenerateStatus}
        </div>
      )}
      
      {error && !isDegenerate && (
        <div className="mb-4 p-2 bg-error/20 border border-error/50 rounded text-sm text-error">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Origin */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Origin
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-secondary mb-1">X</label>
              <input
                type="number"
                step="any"
                value={originX}
                onChange={(e) => handleOriginXChange(e.target.value)}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Y</label>
              <input
                type="number"
                step="any"
                value={originY}
                onChange={(e) => handleOriginYChange(e.target.value)}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Base I Vector */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#f97316' }}>
            Base I Vector
          </label>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-text-secondary">X</label>
                <span className="text-xs text-text-secondary">{baseIX.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={baseIX}
                onChange={(e) => handleBaseIXChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-text-secondary">Y</label>
                <span className="text-xs text-text-secondary">{baseIY.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={baseIY}
                onChange={(e) => handleBaseIYChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        </div>

        {/* Base J Vector */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#10b981' }}>
            Base J Vector
          </label>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-text-secondary">X</label>
                <span className="text-xs text-text-secondary">{baseJX.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={baseJX}
                onChange={(e) => handleBaseJXChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-text-secondary">Y</label>
                <span className="text-xs text-text-secondary">{baseJY.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={baseJY}
                onChange={(e) => handleBaseJYChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        </div>

        {/* Normalization Toggle */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={normalizeEnabled}
              onChange={(e) => handleNormalizeToggle(e.target.checked)}
              className="w-4 h-4 text-primary bg-bg-primary border-border rounded focus:ring-primary focus:ring-2"
            />
            <span className="text-sm text-text-secondary">
              Normalize base vectors
            </span>
          </label>
          <p className="text-xs text-text-secondary mt-1 ml-6">
            When enabled, base vectors will be normalized to unit length. Changing one vector adjusts the other to be orthogonal.
          </p>
        </div>

        {/* Viewport Controls */}
        {onFrameViewportChange && (
          <div className="pt-4 border-t border-border">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Viewport
            </label>
            <div className="flex gap-2">
              <div
                onClick={(e) => {
                  // Immediately blur to remove focus
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur()
                  }
                  e.currentTarget.blur()
                  
                  if (selectedFrame && onFrameViewportChange) {
                    onFrameViewportChange(selectedFrame.id, {
                      ...selectedFrame.viewport,
                      x: 0,
                      y: 0,
                    })
                  }
                }}
                onMouseDown={(e) => {
                  e.currentTarget.classList.add('active-touch')
                }}
                onMouseUp={(e) => {
                  e.currentTarget.classList.remove('active-touch')
                  e.currentTarget.blur()
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.classList.remove('active-touch')
                  e.currentTarget.blur()
                }}
                onTouchEnd={(e) => {
                  // Force blur on touch end
                  e.currentTarget.blur()
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur()
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary hover:bg-hover transition-colors text-sm touch-manipulation cursor-pointer select-none"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.currentTarget.blur()
                    if (selectedFrame && onFrameViewportChange) {
                      onFrameViewportChange(selectedFrame.id, {
                        ...selectedFrame.viewport,
                        x: 0,
                        y: 0,
                      })
                    }
                  }
                }}
                title="Move to frame origin"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2v20M2 12h20" />
                </svg>
                <span>Move to Origin</span>
              </div>
              <div
                onClick={(e) => {
                  // Immediately blur to remove focus
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur()
                  }
                  e.currentTarget.blur()
                  
                  if (selectedFrame && onFrameViewportChange) {
                    onFrameViewportChange(selectedFrame.id, {
                      ...selectedFrame.viewport,
                      zoom: 1.0,
                    })
                  }
                }}
                onMouseDown={(e) => {
                  e.currentTarget.classList.add('active-touch')
                }}
                onMouseUp={(e) => {
                  e.currentTarget.classList.remove('active-touch')
                  e.currentTarget.blur()
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.classList.remove('active-touch')
                  e.currentTarget.blur()
                }}
                onTouchEnd={(e) => {
                  // Force blur on touch end
                  e.currentTarget.blur()
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur()
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary hover:bg-hover transition-colors text-sm touch-manipulation cursor-pointer select-none"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.currentTarget.blur()
                    if (selectedFrame && onFrameViewportChange) {
                      onFrameViewportChange(selectedFrame.id, {
                        ...selectedFrame.viewport,
                        zoom: 1.0,
                      })
                    }
                  }
                }}
                title="Reset zoom to default"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
                <span>Reset Zoom</span>
              </div>
            </div>
          </div>
        )}

        {/* Parameter Sliders */}
        <ParameterSliders
          selectedFrame={selectedFrame}
          onParameterChange={(frameId, parameters) => {
            onFrameUpdate(frameId, { parameters })
          }}
          onCodeRun={onCodeRun}
        />
      </div>
    </div>
  )
}
