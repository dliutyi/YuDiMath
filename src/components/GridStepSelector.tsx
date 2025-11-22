import { useState, useEffect } from 'react'

interface GridStepSelectorProps {
  gridStep: number
  onGridStepChange: (step: number) => void
}

const GRID_STEP_PRESETS = [0.5, 1, 2, 5, 10]

export default function GridStepSelector({
  gridStep,
  onGridStepChange,
}: GridStepSelectorProps) {
  const [isCustom, setIsCustom] = useState(!GRID_STEP_PRESETS.includes(gridStep))
  const [customValue, setCustomValue] = useState(gridStep.toString())

  // Sync internal state when gridStep prop changes
  useEffect(() => {
    const isPreset = GRID_STEP_PRESETS.includes(gridStep)
    setIsCustom(!isPreset)
    if (!isPreset) {
      setCustomValue(gridStep.toString())
    }
  }, [gridStep])

  const handlePresetChange = (preset: number) => {
    setIsCustom(false)
    onGridStepChange(preset)
  }

  const handleCustomChange = (value: string) => {
    setCustomValue(value)
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue > 0) {
      setIsCustom(true)
      onGridStepChange(numValue)
    }
  }

  const handleCustomBlur = () => {
    const numValue = parseFloat(customValue)
    if (isNaN(numValue) || numValue <= 0) {
      // Reset to a valid preset if custom value is invalid
      setCustomValue('1')
      setIsCustom(false)
      onGridStepChange(1)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-text-secondary whitespace-nowrap">
        Grid Step:
      </label>
      <div className="flex items-center gap-1">
        {GRID_STEP_PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePresetChange(preset)}
            className={`px-2 py-1 text-sm rounded transition-colors ${
              !isCustom && Math.abs(gridStep - preset) < 0.001
                ? 'bg-accent text-accent-foreground'
                : 'bg-bg-secondary hover:bg-bg-tertiary text-text-primary'
            }`}
          >
            {preset}
          </button>
        ))}
        <input
          type="number"
          min="0.01"
          step="0.1"
          value={isCustom ? customValue : ''}
          onChange={(e) => handleCustomChange(e.target.value)}
          onBlur={handleCustomBlur}
          onFocus={() => {
            if (!isCustom) {
              setCustomValue(gridStep.toString())
              setIsCustom(true)
            }
          }}
          placeholder="Custom"
          className="w-16 px-2 py-1 text-sm rounded bg-bg-secondary border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </div>
    </div>
  )
}

