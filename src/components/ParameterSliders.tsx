import { useState, useEffect } from 'react'
import type { CoordinateFrame } from '../types'

interface ParameterSlidersProps {
  selectedFrame: CoordinateFrame | null
  onParameterChange: (frameId: string, parameters: Record<string, number>) => void
}

/**
 * Gets the next available parameter name (t1, t2, t3, etc.)
 */
function getNextParameterName(existingParameters: Record<string, number>): string {
  const existingKeys = Object.keys(existingParameters)
  if (existingKeys.length === 0) {
    return 't1'
  }
  
  // Extract numbers from existing keys and find the max
  const numbers = existingKeys
    .map(key => {
      const match = key.match(/^t(\d+)$/i)
      return match ? parseInt(match[1], 10) : 0
    })
    .filter(n => n > 0)
  
  if (numbers.length === 0) {
    return 't1'
  }
  
  const maxNum = Math.max(...numbers)
  return `t${maxNum + 1}`
}

export default function ParameterSliders({
  selectedFrame,
  onParameterChange,
}: ParameterSlidersProps) {
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({})

  // Update parameter values when selected frame changes
  useEffect(() => {
    if (selectedFrame) {
      setParameterValues(selectedFrame.parameters || {})
    } else {
      setParameterValues({})
    }
  }, [selectedFrame])

  const handleAddSlider = () => {
    if (!selectedFrame) return

    const nextName = getNextParameterName(parameterValues)
    const newParameters = {
      ...parameterValues,
      [nextName]: 0, // Default value
    }
    
    setParameterValues(newParameters)
    onParameterChange(selectedFrame.id, newParameters)
  }

  const handleRemoveSlider = (paramName: string) => {
    if (!selectedFrame) return

    const newParameters = { ...parameterValues }
    delete newParameters[paramName]
    
    setParameterValues(newParameters)
    onParameterChange(selectedFrame.id, newParameters)
  }

  const handleSliderChange = (paramName: string, value: number) => {
    if (!selectedFrame) return

    const newParameters = {
      ...parameterValues,
      [paramName]: value,
    }
    
    setParameterValues(newParameters)
    onParameterChange(selectedFrame.id, newParameters)
  }

  if (!selectedFrame) {
    return null
  }

  // Sort parameter names (t1, t2, t3, etc.)
  const sortedParamNames = Object.keys(parameterValues).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0
    const numB = parseInt(b.replace(/\D/g, '')) || 0
    return numA - numB
  })

  return (
    <div className="pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Parameter Sliders</h3>
        <button
          onClick={handleAddSlider}
          className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-primary"
        >
          + Add
        </button>
      </div>

      {sortedParamNames.length === 0 ? (
        <p className="text-xs text-text-secondary italic">No parameters. Click "+ Add" to create one.</p>
      ) : (
        <div className="space-y-3">
          {sortedParamNames.map((paramName) => (
            <div key={paramName} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-text-secondary">
                    {paramName}
                  </label>
                  <span className="text-xs text-text-secondary">
                    {parameterValues[paramName].toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.1"
                  value={parameterValues[paramName]}
                  onChange={(e) => handleSliderChange(paramName, parseFloat(e.target.value))}
                  className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
              <button
                onClick={() => handleRemoveSlider(paramName)}
                className="px-2 py-1 text-xs text-text-secondary hover:text-error hover:bg-error/10 border border-border hover:border-error/50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2 focus:ring-offset-bg-primary"
                title={`Remove ${paramName}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

