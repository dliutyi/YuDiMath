interface GridStepSelectorProps {
  gridStep: number
  onGridStepChange: (step: number) => void
}

const MIN_GRID_STEP = 0.1
const MAX_GRID_STEP = 20

// Convert linear slider value (0-100) to logarithmic grid step (0.1-20)
function sliderToGridStep(sliderValue: number): number {
  const normalized = sliderValue / 100 // 0 to 1
  const logMin = Math.log10(MIN_GRID_STEP)
  const logMax = Math.log10(MAX_GRID_STEP)
  const logValue = logMin + normalized * (logMax - logMin)
  return Math.pow(10, logValue)
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
    onGridStepChange(newGridStep)
  }

  // Format grid step for display (remove unnecessary decimals)
  const formatGridStep = (value: number): string => {
    if (value >= 10) return value.toFixed(0)
    if (value >= 1) return value.toFixed(1)
    return value.toFixed(2)
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

