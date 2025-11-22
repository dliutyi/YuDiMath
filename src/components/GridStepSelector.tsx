interface GridStepSelectorProps {
  gridStep: number
  onGridStepChange: (step: number) => void
}

const MIN_GRID_STEP = 0.1
const MAX_GRID_STEP = 20
const GRID_STEP_INCREMENT = 0.25

// Round to nearest 0.25 increment
function roundToQuarter(value: number): number {
  return Math.round(value / GRID_STEP_INCREMENT) * GRID_STEP_INCREMENT
}

// Convert linear slider value (0-100) to logarithmic grid step (0.1-20)
// and round to nearest 0.25 increment
function sliderToGridStep(sliderValue: number): number {
  const normalized = sliderValue / 100 // 0 to 1
  const logMin = Math.log10(MIN_GRID_STEP)
  const logMax = Math.log10(MAX_GRID_STEP)
  const logValue = logMin + normalized * (logMax - logMin)
  const rawValue = Math.pow(10, logValue)
  // Round to nearest 0.25 increment
  let rounded = roundToQuarter(rawValue)
  // If rounded value is less than minimum, use the smallest valid 0.25 increment (0.25)
  if (rounded < MIN_GRID_STEP) {
    rounded = GRID_STEP_INCREMENT
  }
  // Clamp to maximum
  return Math.min(MAX_GRID_STEP, rounded)
}

// Convert grid step (0.1-20) to linear slider value (0-100)
function gridStepToSlider(gridStep: number): number {
  const clamped = Math.max(MIN_GRID_STEP, Math.min(MAX_GRID_STEP, gridStep))
  const logMin = Math.log10(MIN_GRID_STEP)
  const logMax = Math.log10(MAX_GRID_STEP)
  const logValue = Math.log10(clamped)
  const normalized = (logValue - logMin) / (logMax - logMin)
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

