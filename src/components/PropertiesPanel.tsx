import { useState, useEffect } from 'react'
import type { CoordinateFrame, Point2D } from '../types'
import { areVectorsCollinear, normalizeVector, vectorMagnitude } from '../utils/vectorUtils'

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
  const [baseIX, setBaseIX] = useState<string>('1')
  const [baseIY, setBaseIY] = useState<string>('0')
  const [baseJX, setBaseJX] = useState<string>('0')
  const [baseJY, setBaseJY] = useState<string>('1')
  const [normalizeEnabled, setNormalizeEnabled] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Update form when selected frame changes
  useEffect(() => {
    if (selectedFrame) {
      setOriginX(selectedFrame.origin[0].toString())
      setOriginY(selectedFrame.origin[1].toString())
      setBaseIX(selectedFrame.baseI[0].toString())
      setBaseIY(selectedFrame.baseI[1].toString())
      setBaseJX(selectedFrame.baseJ[0].toString())
      setBaseJY(selectedFrame.baseJ[1].toString())
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
    newBaseIX: string,
    newBaseIY: string,
    newBaseJX: string,
    newBaseJY: string,
    normalize: boolean
  ) => {
    if (!selectedFrame) return

    const originXNum = parseNumber(newOriginX)
    const originYNum = parseNumber(newOriginY)
    const baseIXNum = parseNumber(newBaseIX)
    const baseIYNum = parseNumber(newBaseIY)
    const baseJXNum = parseNumber(newBaseJX)
    const baseJYNum = parseNumber(newBaseJY)

    // Check if all values are valid numbers
    if (
      originXNum === null ||
      originYNum === null ||
      baseIXNum === null ||
      baseIYNum === null ||
      baseJXNum === null ||
      baseJYNum === null
    ) {
      setError('All values must be valid numbers')
      return
    }

    let baseI: Point2D = [baseIXNum, baseIYNum]
    let baseJ: Point2D = [baseJXNum, baseJYNum]

    // Normalize base vectors if enabled
    if (normalize) {
      const normalizedI = normalizeVector(baseI)
      const normalizedJ = normalizeVector(baseJ)
      
      // Check if vectors are zero after normalization
      if (vectorMagnitude(normalizedI) < 1e-10 || vectorMagnitude(normalizedJ) < 1e-10) {
        setError('Base vectors cannot be zero')
        return
      }
      
      baseI = normalizedI
      baseJ = normalizedJ
      
      // Update input fields to show normalized values
      setBaseIX(baseI[0].toString())
      setBaseIY(baseI[1].toString())
      setBaseJX(baseJ[0].toString())
      setBaseJY(baseJ[1].toString())
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
    updateFrame(value, originY, baseIX, baseIY, baseJX, baseJY, normalizeEnabled)
  }

  const handleOriginYChange = (value: string) => {
    setOriginY(value)
    updateFrame(originX, value, baseIX, baseIY, baseJX, baseJY, normalizeEnabled)
  }

  const handleBaseIXChange = (value: string) => {
    setBaseIX(value)
    updateFrame(originX, originY, value, baseIY, baseJX, baseJY, normalizeEnabled)
  }

  const handleBaseIYChange = (value: string) => {
    setBaseIY(value)
    updateFrame(originX, originY, baseIX, value, baseJX, baseJY, normalizeEnabled)
  }

  const handleBaseJXChange = (value: string) => {
    setBaseJX(value)
    updateFrame(originX, originY, baseIX, baseIY, value, baseJY, normalizeEnabled)
  }

  const handleBaseJYChange = (value: string) => {
    setBaseJY(value)
    updateFrame(originX, originY, baseIX, baseIY, baseJX, value, normalizeEnabled)
  }

  const handleNormalizeToggle = (enabled: boolean) => {
    setNormalizeEnabled(enabled)
    // Re-apply normalization if enabled
    if (enabled) {
      updateFrame(originX, originY, baseIX, baseIY, baseJX, baseJY, true)
    }
  }

  if (!selectedFrame) {
    return (
      <div className="w-80 p-4 bg-panel-bg border border-border rounded-lg shadow-lg">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Frame Properties</h2>
        <p className="text-sm text-text-secondary">No frame selected</p>
      </div>
    )
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-secondary mb-1">X</label>
              <input
                type="number"
                step="any"
                value={baseIX}
                onChange={(e) => handleBaseIXChange(e.target.value)}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Y</label>
              <input
                type="number"
                step="any"
                value={baseIY}
                onChange={(e) => handleBaseIYChange(e.target.value)}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Base J Vector */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Base J Vector
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-secondary mb-1">X</label>
              <input
                type="number"
                step="any"
                value={baseJX}
                onChange={(e) => handleBaseJXChange(e.target.value)}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Y</label>
              <input
                type="number"
                step="any"
                value={baseJY}
                onChange={(e) => handleBaseJYChange(e.target.value)}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
            When enabled, base vectors will be normalized to unit length
          </p>
        </div>
      </div>
    </div>
  )
}

