interface GridStepSelectorProps {
  gridStep: number
  onGridStepChange: (step: number) => void
}

const MAX_GRID_STEP = 20
const GRID_STEP_INCREMENT = 0.25

// Round to nearest 0.25 increment
function roundToQuarter(value: number): number {
  return Math.round(value / GRID_STEP_INCREMENT) * GRID_STEP_INCREMENT
}

// Convert linear slider value (0-100) to linear grid step (0.25-20)
// and round to nearest 0.25 increment
function sliderToGridStep(sliderValue: number): number {
  const normalized = sliderValue / 100 // 0 to 1
  // Use linear interpolation from 0.25 to 20
  const minStep = GRID_STEP_INCREMENT // Start from 0.25 (smallest valid increment)
  const rawValue = minStep + normalized * (MAX_GRID_STEP - minStep)
  // Round to nearest 0.25 increment
  const rounded = roundToQuarter(rawValue)
  // Clamp to valid range
  return Math.max(minStep, Math.min(MAX_GRID_STEP, rounded))
}

// Convert grid step (0.25-20) to linear slider value (0-100)
function gridStepToSlider(gridStep: number): number {
  const minStep = GRID_STEP_INCREMENT // Start from 0.25
  const clamped = Math.max(minStep, Math.min(MAX_GRID_STEP, gridStep))
  // Linear interpolation
  const normalized = (clamped - minStep) / (MAX_GRID_STEP - minStep)
  return normalized * 100
}

export default function GridStepSelector({
  gridStep,
  onGridStepChange,
}: GridStepSelectorProps) {
  const sliderValue = gridStepToSlider(gridStep)

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSliderValue = parseFloat(e.target.value)
    const newGridStep = sliderToGridStep(newSliderValue)
    // Ensure the value is rounded to 0.25 increment
    const roundedGridStep = roundToQuarter(newGridStep)
    onGridStepChange(roundedGridStep)
  }

  // Format grid step for display (always show 2 decimal places for 0.25 increments)
  const formatGridStep = (value: number): string => {
    // Round to 0.25 first to ensure clean display
    const rounded = roundToQuarter(value)
    if (rounded >= 10) return rounded.toFixed(0)
    if (rounded >= 1) return rounded.toFixed(1)
    return rounded.toFixed(2)
  }

  return (
    <div className="flex flex-col items-start gap-1 p-3 bg-panel-bg/90 backdrop-blur-sm rounded-lg border border-border shadow-lg">
      <div className="flex items-center gap-2 w-full">
        <label className="text-xs text-text-secondary whitespace-nowrap">
          Grid Step:
        </label>
        <span className="text-sm font-mono text-text-primary min-w-[3rem] text-right">
          {formatGridStep(gridStep)}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="0.25"
        value={sliderValue}
        onChange={handleSliderChange}
        className="w-64 h-2 bg-grid-line rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  )
}

