import { useState, useEffect } from 'react'
import type { CoordinateFrame, Point2D } from '../types'
import { areVectorsCollinear, normalizeVector, vectorMagnitude, orthogonalVector } from '../utils/vectorUtils'

interface PropertiesPanelProps {
  selectedFrame: CoordinateFrame | null
  onFrameUpdate: (frameId: string, updates: Partial<CoordinateFrame>) => void
}

export default function PropertiesPanel({
  selectedFrame,
  onFrameUpdate,
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

    // Validate that base vectors are not collinear
    if (areVectorsCollinear(baseI, baseJ)) {
      setError('Base vectors cannot be collinear (parallel)')
      return
    }

    setError(null)

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

  return (
    <div className="w-80 p-4 bg-panel-bg border border-border rounded-lg shadow-lg">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Frame Properties</h2>
      
      {error && (
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
          <label className="block text-sm font-medium text-text-secondary mb-2">
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
          <label className="block text-sm font-medium text-text-secondary mb-2">
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
      </div>
    </div>
  )
}
